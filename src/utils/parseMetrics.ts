export interface SystemMetrics {
  cpuTemp: number;
  cpuLoad: number;
  gpuTemp: number;
  gpuLoad: number;
  ramUsage: number;
}

export function parseLhmData(node: any, current: Partial<SystemMetrics> = {}): SystemMetrics {
  if (!node) return current as SystemMetrics;

  // Track CPU Metrics (AMD Ryzen 7 9700X)
  if (node.Text?.includes("AMD Ryzen 7 9700X")) {
    findSensors(node, current, "cpu");
  }

  // Track GPU Metrics (NVIDIA GeForce RTX 5070 Ti)
  if (node.Text?.includes("5070") || node.Text?.includes("NVIDIA")) {
    findSensors(node, current, "gpu");
  }

  // Track RAM Metrics (More flexible matching for 'Memory' or 'Generic Memory')
  if (node.Text?.includes("Memory")) {
    findSensors(node, current, "ram");
  }

  if (node.Children) {
    for (const child of node.Children) {
      parseLhmData(child, current);
    }
  }

  return {
    cpuTemp: Math.round(current.cpuTemp || 0),
    cpuLoad: Math.round(current.cpuLoad || 0),
    gpuTemp: Math.round(current.gpuTemp || 0),
    gpuLoad: Math.round(current.gpuLoad || 0),
    ramUsage: Math.round(current.ramUsage || 0),
  };
}

function findSensors(node: any, current: any, type: "cpu" | "gpu" | "ram") {
  if (!node.Children) return;

  for (const child of node.Children) {
    if (type === "cpu" && child.Text === "Temperatures") {
      const tempNode = child.Children?.find((c: any) => 
        c.Text?.includes("Tctl") || c.Text?.includes("Core (Max)") || c.Text === "CPU Core"
      );
      if (tempNode) current.cpuTemp = parseFloat(tempNode.Value);
    }
    if (type === "cpu" && child.Text === "Load") {
      const totalLoad = child.Children?.find((c: any) => c.Text === "CPU Total");
      if (totalLoad) current.cpuLoad = parseFloat(totalLoad.Value);
    }
    if (type === "gpu" && child.Text === "Temperatures") {
      const gpuCore = child.Children?.find((c: any) => c.Text === "GPU Core");
      if (gpuCore) current.gpuTemp = parseFloat(gpuCore.Value);
    }
    if (type === "gpu" && child.Text === "Load") {
      const gpuLoad = child.Children?.find((c: any) => c.Text === "GPU Core");
      if (gpuLoad) current.gpuLoad = parseFloat(gpuLoad.Value);
    }
    if (type === "ram" && child.Text === "Load") {
      // Find the row tracking actual physical memory utilization percentage
      const memoryLoad = child.Children?.find((c: any) => 
        c.Text === "Memory" || c.Text?.includes("Load")
      );
      if (memoryLoad) current.ramUsage = parseFloat(memoryLoad.Value);
    }
    
    findSensors(child, current, type);
  }
}