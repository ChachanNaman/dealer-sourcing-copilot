from fastapi import FastAPI

app = FastAPI(title="Dealer Sourcing Co-pilot API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
