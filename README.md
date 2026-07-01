# PC Telemetry

A minimalist, high-contrast hardware telemetry dashboard designed specifically for an internal 5-inch PC display (480x800 portrait orientation). The dashboard visualizes real-time CPU, GPU, and RAM metrics using a headless data exporter and renders directly to the desktop layer.

## System Architecture
* **Frontend (UI):** React, TypeScript, Vite, Tailwind CSS v4, Lucide React. Runs locally on **Port 8086**.
* **Backend (Data Provider):** Libre Hardware Monitor (LHM) with Remote Web Server enabled. Runs locally on **Port 8085**.
* **Renderer:** Lively Wallpaper. Maps the frontend web server directly to the secondary display for a perfect borderless, native desktop experience.

## Prerequisites
1. **Node.js:** Ensure Node is installed on your system.
2. **Static Server:** Install the `serve` package globally to host the production build:
   ```bash
   npm install -g serve
   ```
3. **Libre Hardware Monitor:** LHM must be running in the background with the Remote Web Server enabled (`Options` -> `Remote Web Server` -> `Run`) on its default port, `8085`.
4. **Lively Wallpaper:** Download and install from the Microsoft Store to handle the borderless UI rendering.

## Development Setup
Clone the repository and install the dependencies:
```bash
npm install
```
Start the Vite development server for making UI changes:
```bash
npm run dev
```

## Production Build & Autostart
To run the dashboard efficiently with minimal system overhead, it must be compiled into a static build rather than running the development server.

### 1. Compile the Project
```bash
npm run build
```
This generates the highly optimized production files in the `/dist` directory.

### 2. Configure the Local Server Script
The root directory contains a `LaunchTelemetry.vbs` script. Since Lively Wallpaper handles the display rendering natively, this script simply boots the static background server silently on **port 8086**.
* Open `LaunchTelemetry.vbs` in a text editor.
* Ensure the hardcoded directory path matches your machine's exact folder structure.

### 3. Enable Autostart
To ensure the dashboard loads automatically when Windows boots, configure both the server and the renderer:

**Start the Server:**
1. Press `Win + R` and type `shell:startup` to open the Windows Startup folder.
2. Do **not** copy the script directly. Instead, create a **shortcut** to `LaunchTelemetry.vbs` and place that shortcut into the Startup folder. This ensures Git continues to track any edits you make to the original script inside your repository.

**Start the Renderer:**
1. Open Lively Wallpaper and ensure it is set to "Start with Windows" in its system settings.
2. Click "Add Wallpaper", select "URL", and enter `http://localhost:8086`.
3. Use Lively's display control panel to assign this new wallpaper exclusively to your internal 5-inch display.