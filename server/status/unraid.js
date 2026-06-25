const { requestJsonPost } = require("../http");

async function readUnraidStatus(target, base) {
  const response = await requestJsonPost(new URL(target.statusPath || "/graphql", target.url).href, {
    headers: { "x-api-key": target.apiKey },
    body: {
      query: `query HomedashStatus {
        info {
          os { distro release uptime }
          cpu { cores threads }
        }
        array {
          state
          capacity { disks { used total free } }
        }
        dockerContainers {
          id
          state
        }
      }`
    }
  });

  if (response.errors?.length) throw new Error(response.errors[0].message || "Unraid API Fehler");
  const data = response.data || {};
  const containers = Array.isArray(data.dockerContainers) ? data.dockerContainers : [];
  const runningContainers = containers.filter((container) => String(container.state).toLowerCase() === "running").length;
  const diskCapacity = data.array?.capacity?.disks || {};
  const used = Number(diskCapacity.used || 0);
  const total = Number(diskCapacity.total || 0);
  const metrics = [
    { label: "Array", value: String(data.array?.state || "unknown") },
    { label: "Docker", value: `${runningContainers}/${containers.length}` }
  ];
  if (total > 0) metrics.push({ label: "Speicher", value: `${Math.round((used / total) * 100)}%` });
  if (data.info?.cpu?.cores) metrics.push({ label: "CPU", value: `${data.info.cpu.cores} Cores` });

  return {
    ...base,
    ok: true,
    status: "online",
    message: data.info?.os?.release ? `Unraid ${data.info.os.release}` : "API erreichbar",
    metrics
  };
}

module.exports = {
  readUnraidStatus
};
