package worker

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/hibiken/asynq"
)

// Enqueuer implements service.JobEnqueuer using Asynq.
type Enqueuer struct {
	client *asynq.Client
}

func NewEnqueuer(client *asynq.Client) *Enqueuer {
	return &Enqueuer{client: client}
}

func (e *Enqueuer) EnqueueEmailVerification(ctx context.Context, userID uuid.UUID, email, token string) error {
	task, err := NewEmailVerificationTask(userID, email, token)
	if err != nil {
		return fmt.Errorf("creating task: %w", err)
	}
	_, err = e.client.EnqueueContext(ctx, task)
	if err != nil {
		return fmt.Errorf("enqueuing task: %w", err)
	}
	return nil
}

func (e *Enqueuer) EnqueuePasswordReset(ctx context.Context, userID uuid.UUID, email, token string) error {
	task, err := NewPasswordResetTask(userID, email, token)
	if err != nil {
		return fmt.Errorf("creating task: %w", err)
	}
	_, err = e.client.EnqueueContext(ctx, task)
	if err != nil {
		return fmt.Errorf("enqueuing task: %w", err)
	}
	return nil
}

func (e *Enqueuer) EnqueueInvitationEmail(ctx context.Context, email, token, tenantName string) error {
	task, err := NewInvitationEmailTask(email, token, tenantName)
	if err != nil {
		return fmt.Errorf("creating task: %w", err)
	}
	_, err = e.client.EnqueueContext(ctx, task)
	if err != nil {
		return fmt.Errorf("enqueuing task: %w", err)
	}
	return nil
}
