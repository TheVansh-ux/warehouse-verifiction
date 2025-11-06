"""
Backend FastAPI server for the Warehouse Verification App.
Handles API requests for scanning and retrieving scan history.
"""

import uvicorn
import mysql.connector
import os
from mysql.connector import pooling
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables from a .env file (for local development)
load_dotenv()

# --- Database Configuration (Reads from Environment Variables) ---
DB_HOST = os.environ.get("DB_HOST")
DB_USER = os.environ.get("DB_USER")
DB_PASSWORD = os.environ.get("DB_PASSWORD")
DB_NAME = os.environ.get("DB_NAME")
DB_PORT = os.environ.get("DB_PORT", 3306) # Default to 3306 if not set

DB_CONFIG = {
    "host": DB_HOST,
    "user": DB_USER,
    "password": DB_PASSWORD,
    "database": DB_NAME,
    "port": DB_PORT,
    # Use mysql_native_password for compatibility
    "auth_plugin": "mysql_native_password" 
}

# --- Database Connection Pool ---
try:
    # Create a connection pool instead of single connections
    cnx_pool = mysql.connector.pooling.MySQLConnectionPool(
        pool_name="barcode_pool",
        pool_size=5,
        **DB_CONFIG
    )
    print("Database connection pool created successfully.")
except mysql.connector.Error as err:
    print(f"Error creating connection pool: {err}")
    print("Please check your environment variables (DB_HOST, DB_USER, etc.)")
    # We don't exit(1) here to allow deployment servers to start
    cnx_pool = None

# --- Dependency for getting DB connection ---
def get_db_connection():
    """
    Dependency to get a connection from the pool.
    """
    if cnx_pool is None:
        raise HTTPException(
            status_code=503, detail="Database connection pool is not available."
        )
        
    try:
        conn = cnx_pool.get_connection()
        yield conn
    except mysql.connector.Error as err:
        raise HTTPException(
            status_code=503, detail=f"Database connection error: {err}"
        )
    finally:
        if 'conn' in locals() and conn.is_connected():
            conn.close()  # Returns the connection to the pool


# --- Pydantic Models ---
class ScanRequest(BaseModel):
    """Request model for submitting a new scan."""
    barcode1: str
    barcode2: str


class ScanResponse(BaseModel):
    """Response model for a single scan record."""
    id: int
    barcode1: str
    barcode2: str
    result: int
    created_at: datetime


# --- FastAPI App Initialization ---
app = FastAPI(title="Warehouse Verification API")

# --- CORS Middleware ---
# Allow all origins (for simple development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


# --- API Endpoints ---
@app.get("/", include_in_schema=False)
def root():
    return {"message": "Warehouse Verification API is running."}


@app.post("/api/scan", summary="Verify and log a new scan")
def create_scan(
    scan: ScanRequest, db=Depends(get_db_connection)
):
    if not scan.barcode1 or not scan.barcode2:
        raise HTTPException(
            status_code=400, detail="Both barcodes must be provided."
        )

    # Compare barcodes
    result = 1 if scan.barcode1 == scan.barcode2 else 0
    result_text = "Match" if result == 1 else "No Match"

    query = "INSERT INTO scans (barcode1, barcode2, result) VALUES (%s, %s, %s)"
    
    try:
        cursor = db.cursor()
        cursor.execute(query, (scan.barcode1, scan.barcode2, result))
        db.commit()
        cursor.close()
    except mysql.connector.Error as err:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database insert error: {err}"
        )

    return {"status": "success", "result": result_text}


@app.get("/api/scans", response_model=List[ScanResponse], summary="Get last 10 scans")
def get_scans(db=Depends(get_db_connection)):
    query = """
    SELECT id, barcode1, barcode2, result, created_at
    FROM scans
    ORDER BY created_at DESC
    LIMIT 10
    """
    
    try:
        cursor = db.cursor(dictionary=True)
        cursor.execute(query)
        scans = cursor.fetchall()
        cursor.close()
        return scans
    except mysql.connector.Error as err:
        raise HTTPException(
            status_code=500, detail=f"Database query error: {err}"
        )


# --- Run the server (for local testing) ---
if __name__ == "__main__":
    # Create a local .env file with your local DB credentials
    # e.g., DB_HOST=127.0.0.1, DB_USER=root, etc.
    print("Starting FastAPI server locally at http://127.0.0.1:8000")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)