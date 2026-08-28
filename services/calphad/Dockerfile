# Alloyra CALPHAD service — hosted so visitors install nothing.
# Runs on its own Fly app (1 GB machine; pycalphad wants ~300-500 MB RSS),
# separate from the 256 MB static web host.

FROM python:3.12-slim
WORKDIR /app

RUN pip install --no-cache-dir "pycalphad>=0.11" "fastapi>=0.115" "uvicorn>=0.30"

# License-vetted, openly redistributable assessed databases (ground rule 4 /
# B-507): MatCalc mc_fe / mc_ni / mc_al (ODbL 1.0 + DbCL 1.0, notices kept
# in-file) and NIST solder (US public domain). Committed to the repo with
# recorded sha256s — see databases/SOURCES.md. No demo/teaching databases.
COPY databases/mc_fe_v2.059.pycalphad.tdb \
     databases/mc_ni_v2.034.pycalphad.tdb \
     databases/mc_al_v2.032.pycalphad.tdb \
     databases/NIST-solder.tdb \
     databases/

COPY main.py ./

EXPOSE 8791
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8791"]
