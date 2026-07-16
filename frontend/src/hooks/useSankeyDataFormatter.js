import { useMemo } from 'react';

/**
 * Custom Hook to process and format raw Sankey flow telemetry data
 * maps UUID source/target identifiers to index-based nodes and links for Recharts/D3.
 * Separates data formatting concern from visual rendering (Single Responsibility Principle).
 */
export const useSankeyDataFormatter = (sankeyRawData) => {
  return useMemo(() => {
    if (!sankeyRawData || sankeyRawData.length === 0) {
      return { nodes: [], links: [] };
    }

    // Step 1: Extract all unique node IDs and map to their metadata
    const nodeMap = new Map();
    sankeyRawData.forEach((link) => {
      if (!nodeMap.has(link.source)) {
        nodeMap.set(link.source, { 
          id: link.source, 
          name: link.source_name, 
          isGameOver: false 
        });
      }
      if (!nodeMap.has(link.target)) {
        nodeMap.set(link.target, { 
          id: link.target, 
          name: link.target_name, 
          isGameOver: link.is_game_over 
        });
      } else if (link.is_game_over) {
        // Update to true if we find any link pointing to it that flags it as game over
        const existing = nodeMap.get(link.target);
        existing.isGameOver = true;
      }
    });

    // Convert map to flat array
    const nodes = Array.from(nodeMap.values());
    const nodeIds = nodes.map(n => n.id);

    // Step 2: Map link sources and targets from UUID strings to node indices
    const links = sankeyRawData.map((link) => {
      const sourceIndex = nodeIds.indexOf(link.source);
      const targetIndex = nodeIds.indexOf(link.target);
      return {
        source: sourceIndex,
        target: targetIndex,
        value: link.value,
        isGameOver: link.is_game_over
      };
    }).filter(link => link.source !== -1 && link.target !== -1);

    return { nodes, links };
  }, [sankeyRawData]);
};
