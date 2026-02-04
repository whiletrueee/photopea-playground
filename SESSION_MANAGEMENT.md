# Session Management

## Overview
All chat sessions with Photopea are automatically saved locally for debugging and history tracking.

## Features

### Auto-Save
- Sessions save automatically 2 seconds after any change
- Saves messages, image URLs, and Photopea state
- Visual indicator (green dot) shows when saving

### Session Storage
- Location: `.sessions/` directory (gitignored)
- Format: JSON files named `{sessionId}.json`
- Each session has a unique 16-character ID (nanoid)

### Session UI
- **Current Session ID**: Displayed in header (truncated to 8 chars)
- **Session List**: Click "X sessions" to view all saved sessions
- **New Session**: Click "New" to start fresh
- **Switch Sessions**: Click any session in the list to load it
- **Delete Sessions**: Click "Del" on any session to remove it

## API Routes

### List all sessions
```bash
GET /api/sessions
```

### Get specific session
```bash
GET /api/sessions/{id}
```

### Save session
```bash
POST /api/sessions
Content-Type: application/json

{
  "id": "session-id",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "messages": [...],
  "metadata": {
    "imageUrls": [...],
    "photopeaSrc": "..."
  }
}
```

### Delete session
```bash
DELETE /api/sessions/{id}
```

## Local Development

Sessions persist across page reloads using:
1. LocalStorage: Current session ID
2. File system: Session data in `.sessions/` folder

## File Structure
```
.sessions/
├── .gitkeep
├── abc123xyz.json       # Session 1
├── def456uvw.json       # Session 2
└── ...
```

## Session Data Format
```json
{
  "id": "unique-session-id",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp",
  "messages": [
    {
      "id": 1,
      "type": "sent | received",
      "content": "message content",
      "rawString": "raw data representation",
      "dataType": "string | ArrayBuffer | etc"
    }
  ],
  "metadata": {
    "imageUrls": ["url1", "url2"],
    "photopeaSrc": "https://www.photopea.com#..."
  }
}
```

## Usage

1. **Start a new session**: App creates one automatically on first load
2. **Send messages**: Chat normally, auto-saves after 2s
3. **View history**: Click session count to see all sessions
4. **Resume session**: Click any session to continue where you left off
5. **Debug**: Access `.sessions/*.json` files directly for analysis
