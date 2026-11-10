# FastAPI Demo for AdminKit

Demonstrates how to mount the AdminKit React Studio into a FastAPI application using `admin-kit-fastapi`.

## Requirements

- Python 3.9+
- `fastapi`, `uvicorn`, `pyyaml`, `httpx`

Install dependencies:
```bash
pip install fastapi uvicorn pyyaml
pip install -e ../../adapters/fastapi
```

## Running the Server

Start the development server using `uvicorn`:

```bash
cd examples/fastapi-demo
uvicorn main:app --reload --port 8000
```

Or run directly with python:
```bash
python main.py
```

## Visiting the Dashboard

- **Admin Studio Dashboard**: [http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin)
- **Admin Metadata JSON**: [http://127.0.0.1:8000/admin/__config](http://127.0.0.1:8000/admin/__config)
- **FastAPI OpenAPI Swagger**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

