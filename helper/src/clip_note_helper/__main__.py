import uvicorn


def main() -> None:
    uvicorn.run("clip_note_helper.api:app", host="127.0.0.1", port=8484, reload=False)


if __name__ == "__main__":
    main()

