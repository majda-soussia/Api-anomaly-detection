# Image Python 3.11-slim, port 8001
FROM python:3.11-slim 
 
WORKDIR /app # Crée (ou utilise) le dossier /app dans le conteneur comme répertoire de travail
 
# Dépendances système minimales requises par tensorflow/scikit-learn
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* #Supprime les fichiers temporaires pour réduire la taille de l image
 
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
 
COPY main.py predictor.py schemas.py ./
COPY ml/ ./ml/
COPY data/ ./data/
 
EXPOSE 8001
 
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
 