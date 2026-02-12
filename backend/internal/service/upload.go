package service

import (
	"context"
	"fmt"
	"mime/multipart"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"pos/internal/model"
)

var allowedImageTypes = map[string]bool{
	"image/jpeg": true,
	"image/png":  true,
	"image/webp": true,
	"image/gif":  true,
}

type UploadService struct {
	client *minio.Client
	bucket string
}

func NewUploadService(endpoint, accessKey, secretKey, bucket, region string, useSSL bool) (*UploadService, error) {
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
		Region: region,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create S3 client: %w", err)
	}

	return &UploadService{
		client: client,
		bucket: bucket,
	}, nil
}

func (s *UploadService) InitBucket(ctx context.Context) error {
	exists, err := s.client.BucketExists(ctx, s.bucket)
	if err != nil {
		return fmt.Errorf("failed to check bucket: %w", err)
	}
	if !exists {
		if err := s.client.MakeBucket(ctx, s.bucket, minio.MakeBucketOptions{}); err != nil {
			return fmt.Errorf("failed to create bucket: %w", err)
		}
	}
	return nil
}

func (s *UploadService) UploadImage(ctx context.Context, tenantID uuid.UUID, file multipart.File, header *multipart.FileHeader) (string, error) {
	contentType := header.Header.Get("Content-Type")
	if !allowedImageTypes[contentType] {
		return "", model.ValidationError("invalid image type: only JPEG, PNG, WebP, and GIF are allowed")
	}

	// Max 10MB
	if header.Size > 10*1024*1024 {
		return "", model.ValidationError("file too large: maximum 10MB")
	}

	ext := filepath.Ext(header.Filename)
	if ext == "" {
		switch contentType {
		case "image/jpeg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		case "image/webp":
			ext = ".webp"
		case "image/gif":
			ext = ".gif"
		}
	}

	objectName := fmt.Sprintf("%s/images/%s%s", tenantID.String(), uuid.New().String(), ext)

	_, err := s.client.PutObject(ctx, s.bucket, objectName, file, header.Size, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", model.InternalError("failed to upload image", err)
	}

	return objectName, nil
}

func (s *UploadService) DeleteImage(ctx context.Context, imageURL string) error {
	objectName := strings.TrimPrefix(imageURL, "/")
	if err := s.client.RemoveObject(ctx, s.bucket, objectName, minio.RemoveObjectOptions{}); err != nil {
		return model.InternalError("failed to delete image", err)
	}
	return nil
}
