# Alloyra CALPHAD service — hosted so visitors install nothing.
# Runs on its own Fly app (1 GB machine; pycalphad wants ~300-500 MB RSS),
# separate from the 256 MB static web host.

FROM python:3.12-slim
WORKDIR /app

RUN pip install --no-cache-dir "pycalphad>=0.11" "fastapi>=0.115" "uvicorn>=0.30"

# Openly published Al-Zn (Mey 1993) database from the official pycalphad
# repository — the same file the pycalphad documentation uses. Additional
# databases are baked in here; only openly redistributable ones (N-5).
ADD https://raw.githubusercontent.com/pycalphad/pycalphad/develop/examples/databases/alzn_mey.tdb databases/alzn_mey.tdb

COPY main.py ./

EXPOSE 8791
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8791"]
