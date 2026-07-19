package worker

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"math/rand"
	"time"

	"lsch2026/backend/internal/config"
	"lsch2026/backend/internal/domain"
)

type Runner struct {
	cfg config.Config
}

func NewRunner(cfg config.Config) *Runner {
	return &Runner{cfg: cfg}
}

func (r *Runner) Run(ctx context.Context, task domain.Task, modelName domain.ModelName) (domain.ModelResult, error) {
	_ = ctx
	seed := hashToSeed(task.ID + string(modelName) + task.DatasetPath)
	rng := rand.New(rand.NewSource(seed))
	base := 0.70 + rng.Float64()*0.25

	params := map[string]string{
		"model":     string(modelName),
		"dataset":   task.DatasetPath,
		"seed":      fmt.Sprintf("%d", seed),
		"endpoint":  endpointForModel(r.cfg, modelName),
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	return domain.ModelResult{
		ModelName: string(modelName),
		Accuracy:  base,
		Params:    params,
		Duration:  0,
	}, nil
}

func endpointForModel(cfg config.Config, modelName domain.ModelName) string {
	switch modelName {
	case domain.ModelResNet50:
		return cfg.ResNetURL
	case domain.ModelVGG16:
		return cfg.VGGURL
	case domain.ModelViT:
		return cfg.ViTURL
	default:
		return ""
	}
}

func hashToSeed(value string) int64 {
	sum := sha1.Sum([]byte(value))
	head := hex.EncodeToString(sum[:8])
	seed := int64(0)
	for _, char := range head {
		seed = seed*16 + int64(hexDigit(char))
	}
	return seed
}

func hexDigit(value rune) int64 {
	switch value {
	case '0':
		return 0
	case '1':
		return 1
	case '2':
		return 2
	case '3':
		return 3
	case '4':
		return 4
	case '5':
		return 5
	case '6':
		return 6
	case '7':
		return 7
	case '8':
		return 8
	case '9':
		return 9
	case 'a':
		return 10
	case 'b':
		return 11
	case 'c':
		return 12
	case 'd':
		return 13
	case 'e':
		return 14
	case 'f':
		return 15
	default:
		return 0
	}
}
