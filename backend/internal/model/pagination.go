package model

import "math"

type PaginationRequest struct {
	Page    int `json:"page" validate:"omitempty,min=1"`
	PerPage int `json:"per_page" validate:"omitempty,min=1,max=100"`
}

func (p *PaginationRequest) Normalize() {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.PerPage < 1 || p.PerPage > 100 {
		p.PerPage = 20
	}
}

func (p *PaginationRequest) Offset() int32 {
	return int32((p.Page - 1) * p.PerPage)
}

func (p *PaginationRequest) Limit() int32 {
	return int32(p.PerPage)
}

type PaginationResponse struct {
	Total      int64 `json:"total"`
	Page       int   `json:"page"`
	PerPage    int   `json:"per_page"`
	TotalPages int   `json:"total_pages"`
}

func NewPaginationResponse(total int64, page, perPage int) PaginationResponse {
	totalPages := int(math.Ceil(float64(total) / float64(perPage)))
	return PaginationResponse{
		Total:      total,
		Page:       page,
		PerPage:    perPage,
		TotalPages: totalPages,
	}
}

type PaginatedResponse struct {
	Data       any                `json:"data"`
	Pagination PaginationResponse `json:"pagination"`
}
