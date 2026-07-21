package dataset

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/mholt/archives"

	"lsch2026/backend/internal/domain"
)

type Service struct {
	baseDir string
}

func NewService(baseDir string) *Service {
	return &Service{baseDir: baseDir}
}

func (s *Service) InspectClasses(archivePath string) ([]string, error) {
	classes := map[string]struct{}{}
	err := walkArchive(archivePath, func(name string, _ func() (io.ReadCloser, error)) error {
		className, ok := classFromPath(name)
		if !ok {
			return nil
		}
		classes[className] = struct{}{}
		return nil
	})
	if err != nil {
		return nil, err
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

	archiveName := "dataset" + filepath.Ext(archivePath)
	output, err := os.Create(filepath.Join(taskDir, archiveName))
	if err != nil {
		return err
	}
	defer output.Close()

	_, err = io.Copy(output, input)
	return err
}

func (s *Service) unpackAndSplit(taskDir, archivePath string, split domain.SplitConfig) error {
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

	filesByClass := map[string][]string{}
	err := walkArchive(archivePath, func(name string, _ func() (io.ReadCloser, error)) error {
		className, ok := classFromPath(name)
		if !ok {
			return nil
		}
		filesByClass[className] = append(filesByClass[className], name)
		return nil
	})
	if err != nil {
		return err
	}

	segmentByName := map[string]string{}
	classByName := map[string]string{}
	for className, files := range filesByClass {
		sort.Strings(files)
		classSplit := split.Default
		if override, ok := split.Classes[className]; ok {
			classSplit = override
		}
		segments := splitByRatio(files, classSplit)
		for segmentName, segmentFiles := range segments {
			for _, name := range segmentFiles {
				segmentByName[name] = segmentName
				classByName[name] = className
			}
		}
	}

	return walkArchive(archivePath, func(name string, open func() (io.ReadCloser, error)) error {
		segment, ok := segmentByName[name]
		if !ok {
			return nil
		}
		className := classByName[name]
		if err := extractFile(name, open, filepath.Join(targetRoots[segment], className)); err != nil {
			return err
		}
		return nil
	})
}

func splitByRatio(files []string, split domain.SplitRatio) map[string][]string {
	if len(files) == 0 {
		return map[string][]string{
			"train": nil,
			"val":   nil,
			"test":  nil,
		}
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

	return map[string][]string{
		"train": files[:trainCount],
		"val":   files[trainCount : trainCount+valCount],
		"test":  files[trainCount+valCount : trainCount+valCount+testCount],
	}
}

func extractFile(name string, open func() (io.ReadCloser, error), targetDir string) error {
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return err
	}

	reader, err := open()
	if err != nil {
		return err
	}
	defer reader.Close()

	outputPath := filepath.Join(targetDir, filepath.Base(name))
	output, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer output.Close()

	_, err = io.Copy(output, reader)
	return err
}

func walkArchive(archivePath string, visit func(name string, open func() (io.ReadCloser, error)) error) error {
	file, err := os.Open(archivePath)
	if err != nil {
		return err
	}
	defer file.Close()

	format, stream, err := archives.Identify(context.Background(), filepath.Base(archivePath), file)
	if err != nil {
		return fmt.Errorf("unsupported archive format: %w", err)
	}
	extractor, ok := format.(archives.Extractor)
	if !ok {
		return fmt.Errorf("unsupported archive format: extractor is not available")
	}

	return extractor.Extract(context.Background(), stream, func(_ context.Context, entry archives.FileInfo) error {
		if entry.IsDir() {
			return nil
		}
		return visit(entry.NameInArchive, func() (io.ReadCloser, error) {
			f, err := entry.Open()
			if err != nil {
				return nil, err
			}
			reader, ok := f.(io.ReadCloser)
			if ok {
				return reader, nil
			}
			return io.NopCloser(f), nil
		})
	})
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
