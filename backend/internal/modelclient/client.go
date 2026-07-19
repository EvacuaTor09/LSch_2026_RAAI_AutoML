package modelclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"lsch2026/backend/internal/config"
	"lsch2026/backend/internal/domain"
)

type Client struct {
	cfg        config.Config
	httpClient *http.Client
	redis      *redis.Client
}

func NewClient(cfg config.Config, redisClient *redis.Client) *Client {
	return &Client{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 90 * time.Minute},
		redis:      redisClient,
	}
}

func (c *Client) Train(ctx context.Context, task domain.Task, modelName domain.ModelName) (domain.ModelResult, error) {
	replicas := c.replicasForModel(modelName)
	if len(replicas) == 0 {
		return domain.ModelResult{}, fmt.Errorf("no replicas configured for %s", modelName)
	}

	endpoint, release, err := c.acquireReplica(ctx, string(modelName), replicas)
	if err != nil {
		return domain.ModelResult{}, err
	}
	defer release()

	requestPayload := map[string]any{
		"task_id":       task.ID,
		"dataset_path":  task.DatasetPath,
		"epochs":        c.cfg.TrainEpochs,
		"learning_rate": c.cfg.LearningRate,
		"batch_size":    c.cfg.BatchSize,
		"image_size":    c.cfg.ImageSize,
		"class_names":   task.ClassNames,
		"num_classes":   len(task.ClassNames),
		"split_config":  task.SplitConfig,
	}
	body, err := json.Marshal(requestPayload)
	if err != nil {
		return domain.ModelResult{}, err
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(endpoint, "/")+"/train", bytes.NewReader(body))
	if err != nil {
		return domain.ModelResult{}, err
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := c.httpClient.Do(request)
	if err != nil {
		return domain.ModelResult{}, err
	}
	defer response.Body.Close()

	var payload struct {
		Status        string         `json:"status"`
		Accuracy      float64        `json:"accuracy"`
		Precision     float64        `json:"precision"`
		Recall        float64        `json:"recall"`
		F1Score       float64        `json:"f1_score"`
		TrainingTime  float64        `json:"training_time"`
		NumParams     int64          `json:"num_params"`
		ModelSizeMB   float64        `json:"model_size_mb"`
		WeightsFile   string         `json:"weights_file"`
		BestValAcc    float64        `json:"best_val_acc"`
		EpochsTrained int            `json:"epochs_trained"`
		BestEpoch     int            `json:"best_epoch"`
		History       map[string]any `json:"history"`
		Error         string         `json:"error"`
	}
	if response.StatusCode >= 300 {
		var errorPayload map[string]any
		_ = json.NewDecoder(response.Body).Decode(&errorPayload)
		if detail, ok := errorPayload["detail"].(string); ok && detail != "" {
			return domain.ModelResult{}, fmt.Errorf(detail)
		}
		return domain.ModelResult{}, fmt.Errorf("model %s returned status %d", modelName, response.StatusCode)
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return domain.ModelResult{}, err
	}

	params := map[string]string{
		"endpoint":       endpoint,
		"weights_file":   payload.WeightsFile,
		"best_val_acc":   fmt.Sprintf("%f", payload.BestValAcc),
		"epochs_trained": fmt.Sprintf("%d", payload.EpochsTrained),
		"best_epoch":     fmt.Sprintf("%d", payload.BestEpoch),
		"num_params":     fmt.Sprintf("%d", payload.NumParams),
		"model_size_mb":   fmt.Sprintf("%f", payload.ModelSizeMB),
	}

	return domain.ModelResult{
		ModelName: string(modelName),
		Accuracy:  payload.Accuracy,
		Params:    params,
		Duration:  time.Duration(payload.TrainingTime * float64(time.Second)),
	}, nil
}

func (c *Client) replicasForModel(modelName domain.ModelName) []string {
	switch modelName {
	case domain.ModelResNet50:
		return c.cfg.ResNetReplicas
	case domain.ModelVGG16:
		return c.cfg.VGGReplicas
	case domain.ModelViT:
		return c.cfg.ViTReplicas
	default:
		return nil
	}
}

func (c *Client) acquireReplica(ctx context.Context, modelName string, replicas []string) (string, func(), error) {
	lockTTL := time.Duration(c.cfg.LockTTLMillis) * time.Millisecond
	if lockTTL <= 0 {
		lockTTL = 30 * time.Minute
	}

	for {
		for index, endpoint := range replicas {
			lockKey := fmt.Sprintf("replica-lock:%s:%d", modelName, index)
			token := fmt.Sprintf("%s-%d", modelName, time.Now().UnixNano())
			acquired, err := c.redis.SetNX(ctx, lockKey, token, lockTTL).Result()
			if err != nil {
				return "", nil, err
			}
			if acquired {
				release := func() {
					_ = c.releaseReplica(context.Background(), lockKey, token)
				}
				return endpoint, release, nil
			}
		}

		select {
		case <-ctx.Done():
			return "", nil, ctx.Err()
		case <-time.After(2 * time.Second):
		}
	}
}

func (c *Client) releaseReplica(ctx context.Context, lockKey, token string) error {
	const releaseScript = `
		if redis.call("get", KEYS[1]) == ARGV[1] then
			return redis.call("del", KEYS[1])
		end
		return 0
	`
	_, err := c.redis.Eval(ctx, releaseScript, []string{lockKey}, token).Result()
	return err
}
