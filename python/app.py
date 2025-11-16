from fastapi import FastAPI, UploadFile, File
from routes.upload import router as upload_router

app = FastAPI()

# include the upload routes
app.include_router(upload_router)

@app.get("/")
def home():
    return {"status": "FastAPI running!"}
