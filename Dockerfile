FROM node:26-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY web/index.html /web/index.html
RUN npm run build

FROM golang:1.26 AS build
WORKDIR /src
COPY service/go.mod service/go.sum ./
RUN go mod download
COPY service/ ./
RUN CGO_ENABLED=0 go build -o /captainmorgue .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /captainmorgue /captainmorgue
COPY roster.yaml /roster.yaml
COPY web/ /web/
COPY web/index.html /web/wall.html
COPY --from=frontend /frontend/dist/ /web/
ENV ROSTER=/roster.yaml WEB_DIR=/web PORT=8080
EXPOSE 8080
ENTRYPOINT ["/captainmorgue"]
