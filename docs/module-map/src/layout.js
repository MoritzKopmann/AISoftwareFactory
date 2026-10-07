const MODULE_ORDER = ['projects', 'skills', 'watcher', 'scheduler', 'runner', 'bridge', 'findings'];
const SLOT = 156;
const BOX_WIDTH = 136;
const MODULE_GAP = 56;
const LEFT_MARGIN = 132;
const HEADER_HEIGHT = 44;
const INTERFACE_HEIGHT = 40;
const USE_CASE_HEIGHT = 74;
const DOMAIN_GAP = 30;
const DOMAIN_LABEL_SPACE = 22;
const INFRA_HEIGHT = 70;
const TRACK_SPACING = 9;
const CHANNEL_PADDING = 22;
const CHARS_PER_LINE = 17;

function wrapCamelCase(name) {
  const words = name.match(/[A-Z][a-z0-9]*|[A-Z]+(?![a-z])|[a-z0-9]+/g) ?? [name];
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line && (line + word).length > CHARS_PER_LINE) {
      lines.push(line);
      line = word;
    } else {
      line += word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function average(values, fallback) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function orderModuleItems(module, edges, domains) {
  const useCases = [...module.useCases];
  const infra = [...module.infra];
  const infraIndex = new Map(infra.map((item, index) => [item.id, index]));
  const usedInfra = (useCaseId) =>
    edges
      .filter((edge) => edge.from === useCaseId && edge.kind === 'uses' && infraIndex.has(edge.to))
      .map((edge) => infraIndex.get(edge.to));
  const originalUseCaseIndex = new Map(useCases.map((item, index) => [item.id, index]));
  useCases.sort((first, second) => {
    const firstKey = average(
      usedInfra(first.id),
      infra.length + originalUseCaseIndex.get(first.id) / 100,
    );
    const secondKey = average(
      usedInfra(second.id),
      infra.length + originalUseCaseIndex.get(second.id) / 100,
    );
    return firstKey - secondKey;
  });
  const domainOf = new Map();
  (domains ?? []).forEach((domain, domainIndex) =>
    domain.useCases.forEach((name) => domainOf.set(name, domainIndex)),
  );
  const barycenterOrder = new Map(useCases.map((item, index) => [item.id, index]));
  useCases.sort(
    (first, second) =>
      (domainOf.get(first.name) ?? 99) - (domainOf.get(second.name) ?? 99) ||
      barycenterOrder.get(first.id) - barycenterOrder.get(second.id),
  );
  const useCaseIndex = new Map(useCases.map((item, index) => [item.id, index]));
  const userPositions = (infraId) =>
    edges
      .filter((edge) => edge.to === infraId && edge.kind === 'uses' && useCaseIndex.has(edge.from))
      .map((edge) => useCaseIndex.get(edge.from));
  infra.sort(
    (first, second) =>
      average(userPositions(first.id), 999) - average(userPositions(second.id), 999),
  );
  const interfaceMethods = [...module.interface].sort(
    (first, second) =>
      (useCaseIndex.get(first.useCase) ?? 999) - (useCaseIndex.get(second.useCase) ?? 999),
  );
  const groups = (domains ?? [{ name: '', useCases: useCases.map((item) => item.name) }])
    .map((domain) => ({
      name: domain.name,
      items: useCases.filter((item) => domain.useCases.includes(item.name)),
    }))
    .filter((group) => group.items.length);
  return { interfaceMethods, useCases, infra, groups };
}

function assignTracks(segments) {
  const sorted = [...segments].sort(
    (first, second) => first.left - second.left || second.right - first.right,
  );
  const trackEnds = [];
  for (const segment of sorted) {
    let track = trackEnds.findIndex((end) => end + 12 < segment.left);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(segment.right);
    } else {
      trackEnds[track] = segment.right;
    }
    segment.track = track;
  }
  return trackEnds.length;
}

function roundedPath(points) {
  const radius = 5;
  let path = `M${points[0].x},${points[0].y}`;
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const cornerRadius = Math.min(radius, inLength / 2, outLength / 2);
    if (cornerRadius < 0.5) {
      path += ` L${corner.x},${corner.y}`;
      continue;
    }
    const beforeX = corner.x - ((corner.x - previous.x) / inLength) * cornerRadius;
    const beforeY = corner.y - ((corner.y - previous.y) / inLength) * cornerRadius;
    const afterX = corner.x + ((next.x - corner.x) / outLength) * cornerRadius;
    const afterY = corner.y + ((next.y - corner.y) / outLength) * cornerRadius;
    path += ` L${beforeX},${beforeY} Q${corner.x},${corner.y} ${afterX},${afterY}`;
  }
  const last = points[points.length - 1];
  return `${path} L${last.x},${last.y}`;
}

export function buildLayout(graph, review = { domains: {}, badges: {} }) {
  const modulesByName = new Map(graph.modules.map((module) => [module.name, module]));
  const moduleNames = [
    ...MODULE_ORDER.filter((name) => modulesByName.has(name)),
    ...graph.modules.map((module) => module.name).filter((name) => !MODULE_ORDER.includes(name)),
  ];

  const nodes = new Map();
  const modules = [];
  const domainBoxes = [];
  let cursorX = LEFT_MARGIN;
  for (const name of moduleNames) {
    const ordered = orderModuleItems(modulesByName.get(name), graph.edges, review.domains[name]);
    const useCaseWidth = ordered.useCases.length * SLOT + (ordered.groups.length - 1) * DOMAIN_GAP;
    const width = Math.max(
      ordered.interfaceMethods.length * SLOT,
      useCaseWidth,
      ordered.infra.length * SLOT,
      SLOT,
    );
    modules.push({ name, x: cursorX, width, badge: review.badges[`module.${name}`] });
    const place = (items, band, makeNode) => {
      const offset = (width - items.length * SLOT) / 2;
      items.forEach((item, index) => {
        const x = cursorX + offset + index * SLOT + (SLOT - BOX_WIDTH) / 2;
        nodes.set(item.id, {
          ...makeNode(item),
          id: item.id,
          band,
          module: name,
          x,
          width: BOX_WIDTH,
        });
      });
    };
    place(ordered.interfaceMethods, 'interface', (item) => ({
      lines: [item.name === 'tools' ? 'tools (MCP)' : `${item.name}()`],
      sub: item.useCase ? null : 'no use case',
      backs: item.useCase,
      title: `${name}.${item.name}${item.useCase ? ` → ${item.useCase.split('.uc.')[1]}` : ' (no use case behind it)'}`,
    }));
    let groupX = cursorX + (width - useCaseWidth) / 2;
    for (const group of ordered.groups) {
      const groupWidth = group.items.length * SLOT;
      group.items.forEach((item, index) => {
        nodes.set(item.id, {
          id: item.id,
          band: 'useCase',
          module: name,
          width: BOX_WIDTH,
          x: groupX + index * SLOT + (SLOT - BOX_WIDTH) / 2,
          lines: wrapCamelCase(item.name.replace(/UseCase$/, '')),
          title: item.name,
          badge: review.badges[item.id],
        });
      });
      domainBoxes.push({ module: name, name: group.name, x: groupX + 4, width: groupWidth - 8 });
      groupX += groupWidth + DOMAIN_GAP;
    }
    place(ordered.infra, 'infra', (item) => ({
      lines: wrapCamelCase(item.name),
      sub: item.kind === 'repository' ? `SQLite · ${item.table}` : `port ${item.port}`,
      kind: item.kind,
      badge: review.badges[item.id],
      title: `${item.name} implements ${item.port}`,
    }));
    cursorX += width + MODULE_GAP;
  }
  const width = cursorX - MODULE_GAP + 24;

  const edges = graph.edges
    .filter((edge) => nodes.has(edge.from) && nodes.has(edge.to))
    .map((edge, index) => ({ ...edge, id: `edge-${index}` }));
  for (const node of nodes.values()) {
    if (node.band === 'interface' && node.backs && nodes.has(node.backs)) {
      edges.push({ id: `backs-${node.id}`, from: node.id, to: node.backs, kind: 'backs' });
    }
  }

  const channelOf = (edge) =>
    edge.kind === 'uses'
      ? 'lower'
      : edge.kind === 'calls' || edge.kind === 'backs'
        ? 'upperCalls'
        : 'upperFlows';
  const endpoints = edges.map((edge) => {
    const source = nodes.get(edge.from);
    const target = nodes.get(edge.to);
    const channel = channelOf(edge);
    const sourceSide =
      channel === 'lower' ? 'bottom' : source.band === 'interface' ? 'bottom' : 'top';
    const targetSide = channel === 'lower' ? 'top' : target.band === 'interface' ? 'bottom' : 'top';
    return { edge, channel, source, target, sourceSide, targetSide };
  });

  const portLists = new Map();
  const addPort = (node, side, entry, otherNode) => {
    const key = `${node.id}:${side}`;
    if (!portLists.has(key)) portLists.set(key, []);
    portLists
      .get(key)
      .push({ entry, otherX: otherNode.x + otherNode.width / 2, isSource: node === entry.source });
  };
  for (const entry of endpoints) {
    addPort(entry.source, entry.sourceSide, entry, entry.target);
    addPort(entry.target, entry.targetSide, entry, entry.source);
  }
  for (const [key, ports] of portLists) {
    const node = nodes.get(key.slice(0, key.lastIndexOf(':')));
    ports.sort((first, second) => first.otherX - second.otherX);
    const usable = node.width - 20;
    ports.forEach((port, index) => {
      const bandShift = node.band === 'interface' ? 7 : node.band === 'infra' ? -7 : 0;
      const x = node.x + 10 + ((index + 0.5) * usable) / ports.length + bandShift;
      if (port.isSource) port.entry.sourceX = x;
      else port.entry.targetX = x;
    });
  }

  const regionPorts = { upper: [], lower: [] };
  for (const entry of endpoints) {
    const region = entry.channel === 'lower' ? 'lower' : 'upper';
    regionPorts[region].push({ entry, key: 'sourceX' }, { entry, key: 'targetX' });
  }
  for (const ports of Object.values(regionPorts)) {
    ports.sort((first, second) => first.entry[first.key] - second.entry[second.key]);
    for (let index = 1; index < ports.length; index++) {
      const previousX = ports[index - 1].entry[ports[index - 1].key];
      const port = ports[index];
      if (port.entry[port.key] - previousX < 4) port.entry[port.key] = previousX + 4;
    }
  }

  const trackCounts = {};
  for (const channel of ['upperCalls', 'upperFlows', 'lower']) {
    const segments = endpoints
      .filter((entry) => entry.channel === channel)
      .map((entry) => {
        entry.left = Math.min(entry.sourceX, entry.targetX);
        entry.right = Math.max(entry.sourceX, entry.targetX);
        return entry;
      });
    trackCounts[channel] = assignTracks(segments);
  }

  const interfaceTop = HEADER_HEIGHT + 16;
  const interfaceBottom = interfaceTop + INTERFACE_HEIGHT;
  const callsTop = interfaceBottom + CHANNEL_PADDING;
  const flowsTop = callsTop + trackCounts.upperCalls * TRACK_SPACING + CHANNEL_PADDING;
  const useCaseTop =
    flowsTop + trackCounts.upperFlows * TRACK_SPACING + CHANNEL_PADDING + DOMAIN_LABEL_SPACE;
  const useCaseBottom = useCaseTop + USE_CASE_HEIGHT;
  const usesTop = useCaseBottom + CHANNEL_PADDING;
  const infraTop = usesTop + trackCounts.lower * TRACK_SPACING + CHANNEL_PADDING;
  const height = infraTop + INFRA_HEIGHT + 24;

  const bandY = {
    interface: [interfaceTop, INTERFACE_HEIGHT],
    useCase: [useCaseTop, USE_CASE_HEIGHT],
    infra: [infraTop, INFRA_HEIGHT],
  };
  for (const node of nodes.values()) {
    [node.y, node.height] = bandY[node.band];
  }
  const sideY = (node, side) => (side === 'top' ? node.y : node.y + node.height);
  const channelTop = { upperCalls: callsTop, upperFlows: flowsTop, lower: usesTop };

  for (const entry of endpoints) {
    const trackY = channelTop[entry.channel] + entry.track * TRACK_SPACING;
    const startY = sideY(entry.source, entry.sourceSide);
    const endY = sideY(entry.target, entry.targetSide);
    const points = [
      { x: entry.sourceX, y: startY },
      { x: entry.sourceX, y: trackY },
      { x: entry.targetX, y: trackY },
      { x: entry.targetX, y: endY },
    ];
    entry.edge.points = points;
    entry.edge.d = roundedPath(points);
    entry.edge.labelX = (entry.sourceX + entry.targetX) / 2;
    entry.edge.labelY = trackY - 4;
  }

  const bands = [
    { label: 'Public interface', y: interfaceTop, height: INTERFACE_HEIGHT },
    { label: 'Calls', y: callsTop - 10, height: flowsTop - callsTop, channel: true },
    { label: 'Events · internal', y: flowsTop - 10, height: useCaseTop - flowsTop, channel: true },
    { label: 'Use cases', y: useCaseTop, height: USE_CASE_HEIGHT },
    { label: 'Uses', y: usesTop - 10, height: infraTop - usesTop, channel: true },
    { label: 'Infra', y: infraTop, height: INFRA_HEIGHT },
  ];

  for (const domain of domainBoxes) {
    domain.y = useCaseTop - DOMAIN_LABEL_SPACE - 4;
    domain.height = USE_CASE_HEIGHT + DOMAIN_LABEL_SPACE + 12;
  }

  return {
    width,
    height,
    modules,
    domainBoxes,
    nodes: [...nodes.values()],
    edges,
    bands,
    headerHeight: HEADER_HEIGHT,
  };
}
