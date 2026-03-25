# pgmq-rest

> Because sometimes your messages need a queue, and your queues need a REST API.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tests](https://github.com/eichenroth/pgmq-rest/actions/workflows/test.yml/badge.svg)](https://github.com/eichenroth/pgmq-rest/actions/workflows/test.yml)

## Overview

pgmq-rest provides a REST API for [PGMQ](https://github.com/tembo-io/pgmq) (PostgreSQL Message Queue), making it easy to integrate message queues into your applications. It runs on Cloudflare Workers using the [Neon](https://neon.tech) serverless driver.

## Features

- 🚀 Simple REST API for [PGMQ](https://github.com/tembo-io/pgmq) (PostgreSQL Message Queue)
- 🔄 Support for sending and receiving messages
- 📦 Batch operations for better performance
- 📊 Queue metrics and monitoring
- ☁️ Cloudflare Workers deployment via Wrangler
- 🦕 Deno for local development
- 📝 Swagger documentation included

## Quick Start

### Prerequisites

- [Deno](https://deno.land) v2+
- A [Neon](https://neon.tech) PostgreSQL database with the `pgmq` extension enabled

### Setup

1. Install dependencies:
    ```bash
    deno install
    ```

2. Initialize the pgmq extension on your Neon database:
    ```sql
    CREATE EXTENSION IF NOT EXISTS pgmq;
    ```

3. Run the development server:
    ```bash
    DATABASE_URL="postgresql://user:password@host/db" deno task dev
    ```

4. Visit `http://localhost:8080/docs` for the Swagger UI.

### Deploy to Cloudflare Workers

1. Set the `DATABASE_URL` secret:
    ```bash
    npx wrangler secret put DATABASE_URL
    ```

2. Deploy:
    ```bash
    deno task deploy
    ```

## Usage Example

Here's a quick example of how to use the API:

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

The API provides the following main endpoints:

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
- `POST /api/v1/set_vt` - Set visibility timeout
- `POST /api/v1/list_queues` - List all queues
- `POST /api/v1/metrics` - Get metrics for a queue
- `POST /api/v1/metrics_all` - Get metrics for all queues

For detailed API documentation, visit `/docs` after starting the service.

## Configuration

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes |
| `PORT` | Server port (local dev only) | No (default: 8080) |

## Performance Considerations

- **Serverless**: Each request uses the Neon HTTP driver for stateless, low-latency queries
- **Batch Operations**: Use `send_batch` for better performance when sending multiple messages
- **Visibility Timeout**: Set appropriate visibility timeout when reading messages to prevent message loss
- **Queue Size**: Monitor queue metrics to prevent queue overflow

## Security

- Always use secure connections (HTTPS) in production
- Store `DATABASE_URL` as a Cloudflare Workers secret
- Use environment variables or secrets management for sensitive configuration
- Regularly update to the latest version for security patches

## Development

1. Install Deno v2+: https://deno.land

2. Install dependencies:
    ```bash
    deno install
    ```

3. Run the development server:
    ```bash
    DATABASE_URL="postgresql://user:password@host/db" deno task dev
    ```

4. Run the linter:
    ```bash
    deno task lint
    ```

5. Run the tests (requires a `DATABASE_URL` pointing to a PostgreSQL database with pgmq):
    ```bash
    DATABASE_URL="postgresql://user:password@host/db" deno task test
    ```

## Troubleshooting

Common issues and solutions:

1. **Connection Issues**
   - Verify your `DATABASE_URL` is correct
   - Check that the Neon database is accessible
   - Verify the pgmq extension is installed

2. **Queue Operations Fail**
   - Check if the queue exists
   - Verify message format
   - Check PostgreSQL logs for errors

3. **Deployment Issues**
   - Ensure `DATABASE_URL` is set as a Cloudflare Workers secret
   - Check wrangler logs: `npx wrangler tail`

## License

This project is licensed under the MIT License.

## Acknowledgments

- Built with [Hono](https://hono.dev/)
- Database driver by [Neon](https://neon.tech)
- Powered by [PGMQ](https://github.com/tembo-io/pgmq)
- Deployed on [Cloudflare Workers](https://workers.cloudflare.com/)

