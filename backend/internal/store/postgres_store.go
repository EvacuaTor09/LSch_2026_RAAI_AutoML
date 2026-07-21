package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"lsch2026/backend/internal/auth"
	"lsch2026/backend/internal/domain"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type PostgresStore struct {
	db *sql.DB
}

func NewPostgresStore(ctx context.Context, dsn string) (*PostgresStore, error) {
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}

	store := &PostgresStore{db: db}
	if err := store.ensureSchema(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return store, nil
}

func (s *PostgresStore) Close() error {
	return s.db.Close()
}

func (s *PostgresStore) Create(ctx context.Context, task domain.Task) error {
	return s.save(ctx, task)
}

func (s *PostgresStore) Update(ctx context.Context, task domain.Task) error {
	return s.save(ctx, task)
}

func (s *PostgresStore) Get(ctx context.Context, id string) (domain.Task, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT id, created_at, status, models, dataset_path, archive_path,
			split_config, class_names, results, best_model, best_accuracy,
			best_params, error, completed_at
		FROM tasks
		WHERE id = $1
	`, id)
	return scanTask(row)
}

func (s *PostgresStore) List(ctx context.Context) ([]domain.Task, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, created_at, status, models, dataset_path, archive_path,
			split_config, class_names, results, best_model, best_accuracy,
			best_params, error, completed_at
		FROM tasks
		ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tasks := make([]domain.Task, 0)
	for rows.Next() {
		task, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, task)
	}
	return tasks, rows.Err()
}

func (s *PostgresStore) ensureSchema(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS users (
			username TEXT PRIMARY KEY,
			password_hash TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);

		CREATE TABLE IF NOT EXISTS tasks (
			id TEXT PRIMARY KEY,
			created_at TIMESTAMPTZ NOT NULL,
			status TEXT NOT NULL,
			models TEXT[] NOT NULL,
			dataset_path TEXT NOT NULL,
			archive_path TEXT NOT NULL,
			split_config JSONB NOT NULL,
			class_names TEXT[] NOT NULL,
			results JSONB NOT NULL DEFAULT '[]'::jsonb,
			best_model TEXT NOT NULL DEFAULT '',
			best_accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
			best_params JSONB NOT NULL DEFAULT '{}'::jsonb,
			error TEXT NOT NULL DEFAULT '',
			completed_at TIMESTAMPTZ
		)
	`)
	return err
}

func (s *PostgresStore) GetUser(ctx context.Context, username string) (auth.User, error) {
	row := s.db.QueryRowContext(ctx, `
		SELECT username, password_hash
		FROM users
		WHERE username = $1
	`, username)

	var user auth.User
	if err := row.Scan(&user.Username, &user.PasswordHash); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return auth.User{}, sql.ErrNoRows
		}
		return auth.User{}, err
	}
	return user, nil
}

func (s *PostgresStore) UpsertUser(ctx context.Context, user auth.User) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO users (username, password_hash)
		VALUES ($1, $2)
		ON CONFLICT (username) DO UPDATE SET
			password_hash = EXCLUDED.password_hash
	`, user.Username, user.PasswordHash)
	return err
}

func (s *PostgresStore) save(ctx context.Context, task domain.Task) error {
	models := make([]string, 0, len(task.Models))
	for _, model := range task.Models {
		models = append(models, string(model))
	}
	classNames := append([]string{}, task.ClassNames...)
	if task.BestParams == nil {
		task.BestParams = map[string]string{}
	}
	if task.Results == nil {
		task.Results = []domain.ModelResult{}
	}

	splitJSON, err := json.Marshal(task.SplitConfig)
	if err != nil {
		return err
	}
	resultsJSON, err := json.Marshal(task.Results)
	if err != nil {
		return err
	}
	bestParamsJSON, err := json.Marshal(task.BestParams)
	if err != nil {
		return err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO tasks (
			id, created_at, status, models, dataset_path, archive_path,
			split_config, class_names, results, best_model, best_accuracy,
			best_params, error, completed_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11,
			$12, $13, $14
		)
		ON CONFLICT (id) DO UPDATE SET
			created_at = EXCLUDED.created_at,
			status = EXCLUDED.status,
			models = EXCLUDED.models,
			dataset_path = EXCLUDED.dataset_path,
			archive_path = EXCLUDED.archive_path,
			split_config = EXCLUDED.split_config,
			class_names = EXCLUDED.class_names,
			results = EXCLUDED.results,
			best_model = EXCLUDED.best_model,
			best_accuracy = EXCLUDED.best_accuracy,
			best_params = EXCLUDED.best_params,
			error = EXCLUDED.error,
			completed_at = EXCLUDED.completed_at
	`,
		task.ID,
		task.CreatedAt,
		string(task.Status),
		models,
		task.DatasetPath,
		task.ArchivePath,
		splitJSON,
		classNames,
		resultsJSON,
		task.BestModel,
		task.BestAccuracy,
		bestParamsJSON,
		task.Error,
		task.CompletedAt,
	)
	return err
}

func scanTask(scanner interface{ Scan(dest ...any) error }) (domain.Task, error) {
	var (
		id            string
		createdAt     time.Time
		status        string
		modelsRaw     any
		datasetPath   string
		archivePath   string
		splitRaw      []byte
		classNamesRaw any
		resultsRaw    []byte
		bestModel     string
		bestAccuracy  float64
		bestParamsRaw []byte
		errorText     string
		completedAt   sql.NullTime
	)

	if err := scanner.Scan(
		&id,
		&createdAt,
		&status,
		&modelsRaw,
		&datasetPath,
		&archivePath,
		&splitRaw,
		&classNamesRaw,
		&resultsRaw,
		&bestModel,
		&bestAccuracy,
		&bestParamsRaw,
		&errorText,
		&completedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return domain.Task{}, fmt.Errorf("task not found")
		}
		return domain.Task{}, err
	}
	models, err := parseStringSliceValue(modelsRaw)
	if err != nil {
		return domain.Task{}, fmt.Errorf("decode models: %w", err)
	}
	classNames, err := parseStringSliceValue(classNamesRaw)
	if err != nil {
		return domain.Task{}, fmt.Errorf("decode class_names: %w", err)
	}

	var splitConfig domain.SplitConfig
	if len(splitRaw) > 0 {
		if err := json.Unmarshal(splitRaw, &splitConfig); err != nil {
			return domain.Task{}, err
		}
	}
	results := make([]domain.ModelResult, 0)
	if len(resultsRaw) > 0 {
		if err := json.Unmarshal(resultsRaw, &results); err != nil {
			return domain.Task{}, err
		}
	}
	bestParams := map[string]string{}
	if len(bestParamsRaw) > 0 {
		if err := json.Unmarshal(bestParamsRaw, &bestParams); err != nil {
			return domain.Task{}, err
		}
	}
	var completed *time.Time
	if completedAt.Valid {
		value := completedAt.Time
		completed = &value
	}

	modelNames := make([]domain.ModelName, 0, len(models))
	for _, model := range models {
		modelNames = append(modelNames, domain.ModelName(model))
	}

	return domain.Task{
		ID:           id,
		CreatedAt:    createdAt,
		Status:       domain.TaskStatus(status),
		Models:       modelNames,
		DatasetPath:  datasetPath,
		ArchivePath:  archivePath,
		SplitConfig:  splitConfig,
		ClassNames:   classNames,
		Results:      results,
		BestModel:    bestModel,
		BestAccuracy: bestAccuracy,
		BestParams:   bestParams,
		Error:        errorText,
		CompletedAt:  completed,
	}, nil
}

func parseStringSliceValue(value any) ([]string, error) {
	switch raw := value.(type) {
	case nil:
		return []string{}, nil
	case []string:
		return append([]string{}, raw...), nil
	case string:
		return parseStringSliceText(raw)
	case []byte:
		return parseStringSliceText(string(raw))
	default:
		return nil, fmt.Errorf("unsupported list type %T", value)
	}
}

func parseStringSliceText(raw string) ([]string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return []string{}, nil
	}

	// Some DB layouts store arrays as JSON text.
	if strings.HasPrefix(trimmed, "[") {
		values := []string{}
		if err := json.Unmarshal([]byte(trimmed), &values); err != nil {
			return nil, err
		}
		return values, nil
	}

	// Postgres array text representation: {a,b,c}
	if strings.HasPrefix(trimmed, "{") && strings.HasSuffix(trimmed, "}") {
		body := strings.TrimSpace(trimmed[1 : len(trimmed)-1])
		if body == "" {
			return []string{}, nil
		}
		parts := strings.Split(body, ",")
		values := make([]string, 0, len(parts))
		for _, part := range parts {
			item := strings.Trim(strings.TrimSpace(part), `"`)
			if item != "" {
				values = append(values, item)
			}
		}
		return values, nil
	}

	if strings.Contains(trimmed, ",") {
		parts := strings.Split(trimmed, ",")
		values := make([]string, 0, len(parts))
		for _, part := range parts {
			item := strings.TrimSpace(part)
			if item != "" {
				values = append(values, item)
			}
		}
		return values, nil
	}

	return []string{trimmed}, nil
}
