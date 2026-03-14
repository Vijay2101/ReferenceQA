import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["questionnaire_ai"]

users_col       = db["users"]
documents_col   = db["documents"]
questionnaires_col = db["questionnaires"]
answers_col     = db["answers"]
runs_col        = db["runs"]          # for version history (nice-to-have)
