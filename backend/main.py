"""
Backend FastAPI server for the Warehouse Verification App.
Handles API requests for scanning and retrieving scan history.
"""

import uvicorn
import mysql.connector
from mysql.connector import pooling
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from datetime import datetime

# --- Database Configuration ---
# !!! IMPORTANT !!!
# Update these values with your local MySQL credentials.
DB_CONFIG = {
    "host": "127.0.0.1",
    "user": "root",  # Change this
    "password": "vansh@mysql",  # Change this
    "database": "barcode_db",
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
    # Exit if we can't connect to the DB
    exit(1)


# --- Dependency for getting DB connection ---
def get_db_connection():
    """
    Dependency to get a connection from the pool.
    This ensures connections are properly managed and returned.
    """
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
# Allow all origins (for simple local development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


# --- API Endpoints ---

@app.post("/api/scan", summary="Verify and log a new scan")
def create_scan(
    scan: ScanRequest, db=Depends(get_db_connection)
):
    """
    Compares two barcodes, stores the result in the database,
    and returns the comparison result.
    """
    if not scan.barcode1 or not scan.barcode2:
        raise HTTPException(
            status_code=400, detail="Both barcodes must be provided."
        )

    # Compare barcodes
    result = 1 if scan.barcode1 == scan.barcode2 else 0
    result_text = "Match" if result == 1 else "No Match"

    # SQL query to insert the new scan
    query = """
    INSERT INTO scans (barcode1, barcode2, result)
    VALUES (%s, %s, %s)
    """
    
    try:
        cursor = db.cursor()
        cursor.execute(query, (scan.barcode1, scan.barcode2, result))
        db.commit()  # Commit the transaction
        cursor.close()
    except mysql.connector.Error as err:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Database insert error: {err}"
        )

    return {"status": "success", "result": result_text}


@app.get("/api/scans", response_model=List[ScanResponse], summary="Get last 10 scans")
def get_scans(db=Depends(get_db_connection)):
    """
    Retrieves the 10 most recent scan records from the database
    in descending order of creation.
    """
    
    query = """
    SELECT id, barcode1, barcode2, result, created_at
    FROM scans
    ORDER BY created_at DESC
    LIMIT 10
    """
    
    try:
        # Use a dictionary cursor to get results as dicts
        cursor = db.cursor(dictionary=True)
        cursor.execute(query)
        scans = cursor.fetchall()
        cursor.close()
        
        # Pydantic will automatically serialize the datetime objects
        return scans
    except mysql.connector.Error as err:
        raise HTTPException(
            status_code=500, detail=f"Database query error: {err}"
        )


# --- Run the server ---
if __name__ == "__main__":
    print("Starting FastAPI server at http://127.0.0.1:8000")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)