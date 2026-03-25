# pgmq-rest

> Because sometimes your messages need a queue, and your queues need a REST API.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://github.com/IntranetFactory/pgmq-rest/actions/workflows/test.yml/badge.svg)](https://github.com/IntranetFactory/pgmq-rest/actions/workflows/test.yml)

## Overview

pgmq-rest provides a REST API for [PGMQ](https://github.com/tembo-io/pgmq) (PostgreSQL Message Queue), making it easy to integrate message queues into your applications.

## Features

- 🚀 Simple REST API for [PGMQ](https://github.com/tembo-io/pgmq) (PostgreSQL Message Queue)
- 🔄 Support for sending and receiving messages
- 📦 Batch operations for better performance
- 📊 Queue metrics and monitoring
- ☁️ Cloudflare Worker deployment via Wrangler
- 📝 Swagger documentation included

## Quick Start (Local Development)

1. Start a local PostgreSQL instance with pgmq:

    ```bash
    # Cleanup existing container and volumes
    docker stop pgmq 2>/dev/null || true
    docker rm pgmq 2>/dev/null || true
    docker volume rm pgmq_data 2>/dev/null || true

    # Start PGMQ
    docker run -d --name pgmq \
      -p 5432:5432 \
      -e POSTGRES_USER=postgres \
      -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=postgres \
      -v pgmq_data:/var/lib/postgresql/data \
      -v $(pwd)/init-pgmq.sql:/docker-entrypoint-initdb.d/init-pgmq.sql \
      tembo.docker.scarf.sh/tembo/pg17-pgmq:latest
    ```

2. Run the development server:

    ```bash
    DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=postgres DB_POOL_SIZE=20 deno task dev
    ```

3. Visit http://localhost:8080/docs for the Swagger UI.

## Quick Start (Docker Compose for Local Testing)

The `example/` directory contains a Docker Compose setup for running PGMQ locally:

```bash
cd example
docker-compose up -d
```

To stop:
```bash
docker-compose down -v
```

## Usage Example

```bash
# Send a single message
curl -X POST http://localhost:8080/api/v1/send \
  -H "Content-Type: application/json" \
  -d '{"queue_name": "my_queue", "msg": {"task": "process_data"}}'
# Response: [123]  # Returns the message ID

# Send multiple messages
curl -X POST http://localhost:8080/api/v1/send_batch \
  -H "Content-Type: application/json" \
  -d '{"queue_name": "my_queue", "msgs": [{"task": "process_data"}, {"task": "process_data"}]}'
# Response: [123, 124]  # Returns message IDs for each message

# Read messages
curl -X POST http://localhost:8080/api/v1/read \
  -H "Content-Type: application/json" \
  -d '{"queue_name": "my_queue", "vt": 30, "qty": 1}'
# Response: [["123", 1, "2024-04-15T12:00:00Z", "2024-04-15T12:00:30Z", {"task": "process_data"}, {}]]
# Format: [msg_id, read_ct, enqueued_at, vt, message, headers]

# Read messages with polling
curl -X POST http://localhost:8080/api/v1/read_with_poll \
  -H "Content-Type: application/json" \
  -d '{"queue_name": "my_queue", "vt": 30, "qty": 1}'
# Response: [["123", 1, "2024-04-15T12:00:00Z", "2024-04-15T12:00:30Z", {"task": "process_data"}, {}]]
# Format: [msg_id, read_ct, enqueued_at, vt, message, headers]
```

## API Reference

The API provides the following endpoints:

- `POST /api/v1/send` - Send a single message to a queue
- `POST /api/v1/send_batch` - Send multiple messages to a queue
- `POST /api/v1/read` - Read messages from a queue
- `POST /api/v1/read_with_poll` - Read messages with polling
- `POST /api/v1/pop` - Pop a message from a queue
- `POST /api/v1/delete` - Delete a message
- `POST /api/v1/delete_batch` - Delete multiple messages
- `POST /api/v1/purge_queue` - Purge all messages from a queue
- `POST /api/v1/archive` - Archive a message
- `POST /api/v1/archive_batch` - Archive multiple messages
- `POST /api/v1/create` - Create a queue
- `POST /api/v1/create_unlogged` - Create an unlogged queue
- `POST /api/v1/drop_queue` - Drop a queue
- `POST /api/v1/set_vt` - Set message visibility timeout
- `POST /api/v1/list_queues` - List all queues
- `POST /api/v1/metrics` - Get metrics for a queue
- `POST /api/v1/metrics_all` - Get metrics for all queues

For detailed API documentation, visit http://localhost:8080/docs after starting the service.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | postgres |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | postgres |
| `DB_POOL_SIZE` | Connection pool size | 20 |

### Cloudflare Worker Environment Variables

When deploying to Cloudflare Workers, set variables via `wrangler.toml` or Wrangler secrets:

```bash
wrangler secret put DB_PASSWORD
```

## Deployment

### Cloudflare Workers

1. Install Wrangler: `npm install -g wrangler` or `deno install -g npm:wrangler`
2. Authenticate: `wrangler login`
3. Update `wrangler.toml` with your database connection details (or use secrets)
4. Deploy: `deno task deploy`

## Development

### Prerequisites

- [Deno](https://deno.land/) v2.x
- A PostgreSQL instance with PGMQ extension

### Running Locally

```bash
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=postgres DB_POOL_SIZE=20 deno task dev
```

### Running Tests

```bash
DB_HOST=localhost DB_PORT=5432 DB_USER=postgres DB_PASSWORD=postgres DB_NAME=postgres DB_POOL_SIZE=20 deno task test
```

## Performance Considerations

- **Connection Pooling**: Adjust `DB_POOL_SIZE` based on your application's concurrency needs
- **Batch Operations**: Use `send_batch` for better performance when sending multiple messages
- **Visibility Timeout**: Set appropriate visibility timeout when reading messages to prevent message loss
- **Queue Size**: Monitor queue metrics to prevent queue overflow

## Security

- Always use secure connections (HTTPS) in production
- Change default credentials in production
- Use environment variables or Wrangler secrets for sensitive configuration
- Consider network isolation for the PostgreSQL instance
- Regularly update to the latest version for security patches

## Troubleshooting

Common issues and solutions:

1. **Connection Issues**
   - Verify PostgreSQL is running and accessible
   - Check network connectivity between services
   - Verify credentials and permissions

2. **Queue Operations Fail**
   - Check if the queue exists
   - Verify message format
   - Check PostgreSQL logs for errors

3. **Performance Issues**
   - Monitor queue metrics
   - Check PostgreSQL performance
   - Adjust connection pool size if needed

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with [Hono](https://hono.dev/)
- Powered by [PGMQ](https://github.com/tembo-io/pgmq)
