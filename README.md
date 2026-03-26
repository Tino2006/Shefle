 
     # Next.js & HeroUI Template

This is a template for creating applications using Next.js 14 (app directory) and HeroUI (v2).

[Try it on CodeSandbox](https://githubbox.com/heroui-inc/heroui/next-app-template)

## Technologies Used

- [Next.js 14](https://nextjs.org/docs/getting-started)
- [HeroUI v2](https://heroui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Tailwind Variants](https://tailwind-variants.org)
- [TypeScript](https://www.typescriptlang.org/)
- [Framer Motion](https://www.framer.com/motion/)
- [next-themes](https://github.com/pacocoursey/next-themes)

## How to Use

### Use the template with create-next-app

To create a new project based on this template using `create-next-app`, run the following command:

```bash
npx create-next-app -e https://github.com/heroui-inc/next-app-template
```

### Install dependencies

You can use one of them `npm`, `yarn`, `pnpm`, `bun`, Example using `npm`:

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

### Setup pnpm (optional)

If you are using `pnpm`, you need to add the following code to your `.npmrc` file:

```bash
public-hoist-pattern[]=*@heroui/*
```

After modifying the `.npmrc` file, you need to run `pnpm install` again to ensure that the dependencies are installed correctly.

## Daily Dataset Automation

### USPTO TRTDXFAP Auto-Downloader

Automatically download and import the latest USPTO trademark daily application files using the Bulk Datasets API.

#### Prerequisites

1. Get your USPTO API key from [https://developer.uspto.gov/](https://developer.uspto.gov/)
2. Add it to your `.env.local` file:

```bash
USPTO_API_KEY=your_api_key_here
```

#### Usage

**Download and import the latest file:**

```bash
npx tsx scripts/uspto/download_latest_trtdxfap.ts
```

**Dry-run mode (see what would be downloaded without downloading):**

```bash
npx tsx scripts/uspto/download_latest_trtdxfap.ts --dry-run
```

**Download only (skip automatic import):**

```bash
npx tsx scripts/uspto/download_latest_trtdxfap.ts --no-import
```

**Keep more old files (default keeps 3 most recent):**

```bash
npx tsx scripts/uspto/download_latest_trtdxfap.ts --keep-files=5
```

**Disable automatic cleanup:**

```bash
npx tsx scripts/uspto/download_latest_trtdxfap.ts --no-cleanup
```

#### Features

- **Smart file selection**: Automatically selects the latest file by release date or filename
- **Skip existing files**: Won't re-download files that already exist in `./downloads/`
- **Streaming download**: Efficiently downloads large files with progress tracking
- **Redirect handling**: Follows redirects automatically
- **Safe writes**: Uses temporary files and atomic renames to prevent corruption
- **Concurrent run prevention**: Lock file prevents multiple simultaneous downloads
- **Automatic import**: Optionally runs the importer after download completes
- **Automatic cleanup**: Deletes old ZIP files after successful import (keeps 3 most recent by default)
- **Detailed logging**: Shows file info, release date, size, and download progress

#### How it works

1. Calls the USPTO Bulk Datasets API (`https://api.uspto.gov/api/v1/datasets/products/TRTDXFAP`) with `X-API-KEY` header authentication
2. Parses the response structure: `bulkDataProductBag[0].productFileBag.fileDataBag`
3. Selects the latest file based on `fileReleaseDate` (or filename if date is missing)
4. Checks if the file already exists in `./downloads/` and skips if found
5. Downloads the file via `fileDownloadURI` using streaming with authenticated requests
6. Writes to a temporary file first (`.tmp`), then renames atomically to prevent corruption
7. Optionally runs the existing importer: `import_daily_applications.ts --zip=<file>`
8. **Automatically cleans up old ZIP files** after successful import (keeps 3 most recent by default to save disk space)
9. Creates a lock file (`downloads/.download.lock`) during operation to prevent concurrent runs

#### Troubleshooting

**Lock file error**: If you see "Another download is already in progress", either:
- Wait for the current download to finish, or
- Delete the stale lock file: `rm downloads/.download.lock`

**API key error**: Make sure `USPTO_API_KEY` is set in `.env.local`

**Download fails**: Check your internet connection and verify the API is accessible

## License

Licensed under the [MIT license](https://github.com/heroui-inc/next-app-template/blob/main/LICENSE).
