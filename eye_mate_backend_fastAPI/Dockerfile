FROM python:3.11-slim AS builder

ENV VENV_PATH=/opt/venv \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN python -m venv $VENV_PATH
ENV PATH="$VENV_PATH/bin:$PATH"

COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

FROM python:3.11-slim AS runtime

ENV VENV_PATH=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY --from=builder $VENV_PATH $VENV_PATH

COPY app /app/app
COPY main.py /app/main.py

# Listen on all interfaces so the API is reachable via LAN/VPN/Docker port publish.
ENV HOST=0.0.0.0
ENV PORT=8000
# Default Hugging Face download cache (mount a volume here to avoid re-downloading the model).
ENV HF_HOME=/root/.cache/huggingface

EXPOSE 8000

CMD ["python", "main.py"]
