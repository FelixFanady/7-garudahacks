import 'package:latlong2/latlong.dart';

class RoadNode {
  final String id;
  final String name;
  final LatLng position;

  RoadNode({required this.id, required this.name, required this.position});
}

class RoadEdge {
  final String from;
  final String to;
  final double distance; // in km
  final int potholes;
  final List<LatLng> pathPoints; // geometry for drawing

  RoadEdge({
    required this.from,
    required this.to,
    required this.distance,
    required this.potholes,
    required this.pathPoints,
  });
}

class DijkstraResult {
  final List<RoadNode> path;
  final double totalDistance;
  final int totalPotholes;
  final List<LatLng> geometry;

  DijkstraResult({
    required this.path,
    required this.totalDistance,
    required this.totalPotholes,
    required this.geometry,
  });
}

class RoadGraph {
  final Map<String, RoadNode> nodes = {};
  final List<RoadEdge> edges = [];

  RoadGraph() {
    // Populate default nodes (Central Jakarta / Sudirman-Thamrin style)
    _addNode('MONAS', 'Simpang Monas', LatLng(-6.1754, 106.8272));
    _addNode('SARINAH', 'Perempatan Sarinah', LatLng(-6.1874, 106.8240));
    _addNode('HI', 'Bundaran HI', LatLng(-6.1950, 106.8231));
    _addNode('SEMANGGI', 'Simpang Susun Semanggi', LatLng(-6.2197, 106.8153));
    _addNode('SENAYAN', 'Bundaran Senayan', LatLng(-6.2272, 106.8008));
    _addNode('SLIPI', 'Simpang Slipi', LatLng(-6.2012, 106.7972));
    _addNode('TANAH_ABANG', 'Simpang Tanah Abang', LatLng(-6.1856, 106.8124));

    // Populate edges with distances, pothole counts, and path geometries
    // Edge: Monas to Sarinah (Direct Thamrin - smooth, 0 potholes)
    _addEdge(
      'MONAS',
      'SARINAH',
      1.4,
      0,
      [
        LatLng(-6.1754, 106.8272),
        LatLng(-6.1800, 106.8255),
        LatLng(-6.1874, 106.8240),
      ],
    );

    // Edge: Sarinah to Bundaran HI (Direct Thamrin - damaged, 6 potholes!)
    // Short path but many potholes
    _addEdge(
      'SARINAH',
      'HI',
      0.9,
      6,
      [
        LatLng(-6.1874, 106.8240),
        LatLng(-6.1910, 106.8235),
        LatLng(-6.1950, 106.8231),
      ],
    );

    // Edge: Alternative path Sarinah -> Tanah Abang -> HI (Smooth, 0 potholes, but longer: 1.8km)
    _addEdge(
      'SARINAH',
      'TANAH_ABANG',
      1.1,
      0,
      [
        LatLng(-6.1874, 106.8240),
        LatLng(-6.1865, 106.8180),
        LatLng(-6.1856, 106.8124),
      ],
    );
    _addEdge(
      'TANAH_ABANG',
      'HI',
      1.3,
      0,
      [
        LatLng(-6.1856, 106.8124),
        LatLng(-6.1910, 106.8130),
        LatLng(-6.1950, 106.8231),
      ],
    );

    // Edge: Bundaran HI to Semanggi (Direct Sudirman - damaged, 8 potholes!)
    _addEdge(
      'HI',
      'SEMANGGI',
      2.8,
      8,
      [
        LatLng(-6.1950, 106.8231),
        LatLng(-6.2050, 106.8200),
        LatLng(-6.2197, 106.8153),
      ],
    );

    // Edge: Alternative path Bundaran HI -> Slipi -> Semanggi (Smooth, 0 potholes, but longer: 4.2km)
    _addEdge(
      'HI',
      'SLIPI',
      2.5,
      0,
      [
        LatLng(-6.1950, 106.8231),
        LatLng(-6.1980, 106.8080),
        LatLng(-6.2012, 106.7972),
      ],
    );
    _addEdge(
      'SLIPI',
      'SEMANGGI',
      2.3,
      1,
      [
        LatLng(-6.2012, 106.7972),
        LatLng(-6.2120, 106.8050),
        LatLng(-6.2197, 106.8153),
      ],
    );

    // Edge: Semanggi to Senayan (Smooth, 0 potholes)
    _addEdge(
      'SEMANGGI',
      'SENAYAN',
      1.7,
      0,
      [
        LatLng(-6.2197, 106.8153),
        LatLng(-6.2230, 106.8090),
        LatLng(-6.2272, 106.8008),
      ],
    );
  }

  void _addNode(String id, String name, LatLng position) {
    nodes[id] = RoadNode(id: id, name: name, position: position);
  }

  void _addEdge(String from, String to, double distance, int potholes, List<LatLng> path) {
    edges.add(RoadEdge(from: from, to: to, distance: distance, potholes: potholes, pathPoints: path));
    // Support bi-directional paths
    edges.add(RoadEdge(
      from: to,
      to: from,
      distance: distance,
      potholes: potholes,
      pathPoints: path.reversed.toList(),
    ));
  }

  DijkstraResult? findShortestPath(String startId, String endId, double potholeFactor) {
    if (!nodes.containsKey(startId) || !nodes.containsKey(endId)) return null;

    final Map<String, double> distances = {};
    final Map<String, String?> predecessors = {};
    final Set<String> unvisited = Set.from(nodes.keys);

    for (var nodeId in nodes.keys) {
      distances[nodeId] = double.infinity;
      predecessors[nodeId] = null;
    }
    distances[startId] = 0.0;

    while (unvisited.isNotEmpty) {
      String? u;
      double minDistance = double.infinity;

      for (var nodeId in unvisited) {
        if (distances[nodeId]! < minDistance) {
          minDistance = distances[nodeId]!;
          u = nodeId;
        }
      }

      if (u == null || u == endId) break;
      unvisited.remove(u);

      // Find neighbors of u
      final neighbors = edges.where((e) => e.from == u);
      for (var edge in neighbors) {
        if (!unvisited.contains(edge.to)) continue;

        // Weight = distance * (1 + potholes * factor)
        final weight = edge.distance * (1.0 + edge.potholes * potholeFactor);
        final alt = distances[u]! + weight;

        if (alt < distances[edge.to]!) {
          distances[edge.to] = alt;
          predecessors[edge.to] = u;
        }
      }
    }

    if (distances[endId] == double.infinity) return null;

    // Reconstruct path
    final List<RoadNode> path = [];
    String? current = endId;
    while (current != null) {
      path.insert(0, nodes[current]!);
      current = predecessors[current];
    }

    // Reconstruct exact geometry and count total distance/potholes
    double totalDist = 0.0;
    int totalPotholes = 0;
    final List<LatLng> geom = [];

    for (int i = 0; i < path.length - 1; i++) {
      final fromId = path[i].id;
      final toId = path[i + 1].id;

      // Find the edge
      final edge = edges.firstWhere((e) => e.from == fromId && e.to == toId);
      totalDist += edge.distance;
      totalPotholes += edge.potholes;

      if (geom.isEmpty) {
        geom.addAll(edge.pathPoints);
      } else {
        // Skip duplicate connecting point
        geom.addAll(edge.pathPoints.skip(1));
      }
    }

    return DijkstraResult(
      path: path,
      totalDistance: totalDist,
      totalPotholes: totalPotholes,
      geometry: geom,
    );
  }
}
