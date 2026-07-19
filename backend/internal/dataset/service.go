package dataset

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"lsch2026/backend/internal/domain"
)

type Service struct {
	baseDir string
}

func NewService(baseDir string) *Service {
	return &Service{baseDir: baseDir}
}

func (s *Service) InspectClasses(archivePath string) ([]string, error) {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return nil, err
	}
	defer reader.Close()

	classes := map[string]struct{}{}
	for _, file := range reader.File {
		className, ok := classFromPath(file.Name)
		if !ok {
			continue
		}
		classes[className] = struct{}{}
	}

	result := make([]string, 0, len(classes))
	for className := range classes {
		result = append(result, className)
	}
	sort.Strings(result)
	return result, nil
}

func (s *Service) Prepare(taskID, archivePath string, split domain.SplitConfig) (string, []string, error) {
	classes, err := s.InspectClasses(archivePath)
	if err != nil {
		return "", nil, err
	}

	taskDir := filepath.Join(s.baseDir, taskID)
	if err := os.MkdirAll(taskDir, 0o755); err != nil {
		return "", nil, err
	}

	if err := s.copyArchive(taskDir, archivePath); err != nil {
		return "", nil, err
	}
	if err := s.unpackAndSplit(taskDir, archivePath, split); err != nil {
		return "", nil, err
	}

	return taskDir, classes, nil
}

func (s *Service) copyArchive(taskDir, archivePath string) error {
	input, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer input.Close()

	output, err := os.Create(filepath.Join(taskDir, "dataset.zip"))
	if err != nil {
		return err
	}
	defer output.Close()

	_, err = io.Copy(output, input)
	return err
}

func (s *Service) unpackAndSplit(taskDir, archivePath string, split domain.SplitConfig) error {
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return err
	}
	defer reader.Close()

	targetRoots := map[string]string{
		"train": filepath.Join(taskDir, "train"),
		"val":   filepath.Join(taskDir, "val"),
		"test":  filepath.Join(taskDir, "test"),
	}
	for _, path := range targetRoots {
		if err := os.MkdirAll(path, 0o755); err != nil {
			return err
		}
	}

	filesByClass := map[string][]*zip.File{}
	for _, file := range reader.File {
		if file.FileInfo().IsDir() {
			continue
		}
		className, ok := classFromPath(file.Name)
		if !ok {
			continue
		}
		filesByClass[className] = append(filesByClass[className], file)
	}

	for className, files := range filesByClass {
		sort.Slice(files, func(i, j int) bool {
			return files[i].Name < files[j].Name
		})
		classSplit := split.Default
		if override, ok := split.Classes[className]; ok {
			classSplit = override
		}
		if err := copySplitFiles(files, targetRoots, className, classSplit); err != nil {
			return err
		}
	}
	return nil
}

func copySplitFiles(files []*zip.File, targetRoots map[string]string, className string, split domain.SplitRatio) error {
	if len(files) == 0 {
		return nil
	}

	trainCount := int(float64(len(files)) * split.Train / 100)
	valCount := int(float64(len(files)) * split.Val / 100)
	if trainCount < 0 {
		trainCount = 0
	}
	if valCount < 0 {
		valCount = 0
	}
	if trainCount+valCount > len(files) {
		valCount = max(0, len(files)-trainCount)
	}
	testCount := len(files) - trainCount - valCount
	if testCount < 0 {
		testCount = 0
	}

	segments := []struct {
		name  string
		files []*zip.File
	}{
		{name: "train", files: files[:trainCount]},
		{name: "val", files: files[trainCount : trainCount+valCount]},
		{name: "test", files: files[trainCount+valCount : trainCount+valCount+testCount]},
	}

	for _, segment := range segments {
		for _, file := range segment.files {
			if err := extractFile(file, filepath.Join(targetRoots[segment.name], className)); err != nil {
				return err
			}
		}
	}
	return nil
}

func extractFile(file *zip.File, targetDir string) error {
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return err
	}

	reader, err := file.Open()
	if err != nil {
		return err
	}
	defer reader.Close()

	outputPath := filepath.Join(targetDir, filepath.Base(file.Name))
	output, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer output.Close()

	_, err = io.Copy(output, reader)
	return err
}

func classFromPath(name string) (string, bool) {
	cleaned := filepath.ToSlash(strings.TrimSpace(name))
	parts := strings.Split(cleaned, "/")
	if len(parts) < 2 {
		return "", false
	}
	className := strings.TrimSpace(parts[0])
	if className == "" || className == "." || className == ".." {
		return "", false
	}
	return className, true
}

func max(left, right int) int {
	if left > right {
		return left
	}
	return right
}
