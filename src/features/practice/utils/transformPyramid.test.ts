import { describe, expect, it } from 'vitest';

import { generateFlowData } from './transformPyramid';

const pyramidData = {
  conclusion: 'Keep practicing daily',
  arguments: [
    {
      point: 'Build a habit',
      headline: 'Habit',
      status: 'strong',
      sub_points: [
        {
          point: 'Practice after breakfast',
          status: 'weak',
        },
      ],
    },
    {
      point: 'Review mistakes',
      status: 'missing',
    },
  ],
};

describe('features/practice/generateFlowData', () => {
  it('returns an empty graph for missing pyramid data', () => {
    expect(generateFlowData(null)).toEqual({ nodes: [], edges: [] });
  });

  it('creates a tree graph for the default Minto-style pyramid', () => {
    const { nodes, edges } = generateFlowData(pyramidData);

    expect(nodes.map((node) => node.id)).toEqual(['root', 'root-0', 'root-0-0', 'root-1']);
    expect(edges.map((edge) => [edge.source, edge.target])).toEqual([
      ['root', 'root-0'],
      ['root-0', 'root-0-0'],
      ['root', 'root-1'],
    ]);
    expect(edges.find((edge) => edge.target === 'root-1')).toMatchObject({ animated: true });
  });

  it('creates sequential top-level edges for STAR-style frameworks', () => {
    const { edges } = generateFlowData(pyramidData, false, false, {}, 'STAR');

    expect(edges.map((edge) => [edge.source, edge.target])).toContainEqual(['root', 'root-0']);
    expect(edges.map((edge) => [edge.source, edge.target])).toContainEqual(['root-0', 'root-1']);
  });

  it('uses compact edge styling on mobile layouts', () => {
    const { edges } = generateFlowData(pyramidData, false, true);

    expect(edges.every((edge) => edge.style?.strokeWidth === 1)).toBe(true);
  });
});
