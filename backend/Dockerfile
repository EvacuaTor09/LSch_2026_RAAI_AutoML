FROM golang:1.24-bookworm AS build
WORKDIR /src

# Only the packages imported by ./cmd/... are resolved — do not run go mod tidy
# here (it walks the whole module tree and can pull unrelated deps from storage/).
ENV GOTOOLCHAIN=local
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/api ./cmd/api && \
    CGO_ENABLED=0 GOOS=linux go build -o /out/worker ./cmd/worker

FROM gcr.io/distroless/base-debian12
WORKDIR /app
COPY --from=build /out/api /app/api
COPY --from=build /out/worker /app/worker
EXPOSE 8080
ENTRYPOINT ["/app/api"]
