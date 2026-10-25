# Queen MD Loader

Downloads the Queen MD bot repo, extracts it, and runs its root index.js.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/Naveed-MD-1835/queen-md-loader)

## Local Installation

```bash
git clone https://github.com/Naveed-MD-1835/queen-md-loader.git
cd queen-md-loader
npm install
npm start
```

## Docker Deployment

```bash
docker build -t queen-md-loader .
docker run -d --name queen-bot queen-md-loader
```

## Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `MONGODB_URL` | MongoDB connection string for database storage | |
| `DB_NAME` | Database name for MongoDB | Queen Md |
| `PORT` | Port the bot listens on | Host default |

The loader file holds a placeholder token. Insert your own token before use.
