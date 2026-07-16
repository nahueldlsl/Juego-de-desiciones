import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSankeyDataFormatter } from '../hooks/useSankeyDataFormatter';
import {
  Sankey,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ScatterChart,
  Scatter,
  ResponsiveContainer,
  ZAxis,
  Cell
} from 'recharts';
import './TeacherDashboard.css';

const TeacherDashboard = () => {
  const { roomPin } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [activeTab, setActiveTab] = useState('sankey'); // 'sankey' | 'splits' | 'velocity'

  // Fetch telemetry analytics data from Django backend endpoint
  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        // Resolve roomId first by searching rooms
        const roomRes = await fetch(`http://127.0.0.1:8000/api/rooms/`);
        if (!roomRes.ok) throw new Error('Error al obtener lista de salas.');
        
        const rooms = await roomRes.json();
        const activeRoom = rooms.find(r => r.pin_code === roomPin);
        
        if (!activeRoom) {
          throw new Error(`No se encontró la sala con el PIN: ${roomPin}`);
        }

        // Fetch detailed analytics using room id
        const analyticsRes = await fetch(`http://127.0.0.1:8000/api/rooms/${activeRoom.room_id}/analytics/`);
        if (!analyticsRes.ok) {
          throw new Error('No se pudieron obtener las analíticas de esta sala.');
        }

        const data = await analyticsRes.json();
        setAnalyticsData(data);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [roomPin]);

  // --- 1. Sankey Data & Custom Formatting ---
  const sankeyRawData = analyticsData?.sankey_data || [];
  const sankeyData = useSankeyDataFormatter(sankeyRawData);

  // Custom Sankey node renderer
  const renderSankeyNode = ({ x, y, width, height, index, payload, containerWidth }) => {
    const isGameOver = payload.isGameOver;
    const isLeft = x < 400; // Layout split reference
    
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={isGameOver ? '#ef4444' : '#22c55e'}
          rx={4}
          style={{ cursor: 'pointer', stroke: '#111827', strokeWidth: 1.5 }}
        />
        <text
          x={isLeft ? x + width + 8 : x - 8}
          y={y + height / 2 + 4}
          textAnchor={isLeft ? 'start' : 'end'}
          fontSize={11}
          fontWeight="bold"
          fill="#f3f4f6"
        >
          {payload.name}
        </text>
      </g>
    );
  };

  // Custom Sankey link renderer
  const renderSankeyLink = ({ sourceX, sourceY, targetX, targetY, width, payload }) => {
    const isGameOver = payload.isGameOver;
    // Red gradient/tint for Game Over branches, green for survival paths
    const strokeColor = isGameOver ? 'rgba(239, 68, 68, 0.45)' : 'rgba(34, 197, 94, 0.45)';
    
    const path = `M${sourceX},${sourceY + width / 2} C${(sourceX + targetX) / 2},${sourceY + width / 2} ${(sourceX + targetX) / 2},${targetY + width / 2} ${targetX},${targetY + width / 2}`;
    
    return (
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={Math.max(2, width)}
        className="sankey-link-path"
      />
    );
  };

  // --- 2. Bottlenecks / Split Decisions logic (Memoized) ---
  const controversialDecisions = useMemo(() => {
    if (!analyticsData?.vote_distributions) return [];

    const processed = analyticsData.vote_distributions.map(scene => {
      const choices = scene.choices;
      if (choices.length < 2) return { ...scene, splitDiff: 100 };

      // Sort choices by votes descending
      const sorted = [...choices].sort((a, b) => b.votes - a.votes);
      const topVotes = sorted[0].votes;
      const runnerUpVotes = sorted[1].votes;
      const total = scene.total_votes;

      // Difference in percentage points between top two choices (lower = closer to a tie)
      const diffPercentage = total > 0 ? ((topVotes - runnerUpVotes) / total) * 100 : 100;

      return {
        ...scene,
        splitDiff: Math.round(diffPercentage),
        topChoices: sorted
      };
    });

    // Return decisions with at least 2 choices, sorted by closest split first
    return processed
      .filter(s => s.choices.length >= 2)
      .sort((a, b) => a.splitDiff - b.splitDiff)
      .slice(0, 4); // Top 4 controversial bottleneck points
  }, [analyticsData]);

  // --- 3. Reaction Time Scatter Data (Memoized) ---
  const scatterPlotData = useMemo(() => {
    if (!analyticsData?.raw_records) return [];

    // Map raw records to points
    return analyticsData.raw_records.map((rec, idx) => ({
      id: idx,
      sceneTitle: rec.scene_title,
      participantName: rec.participant_name,
      choiceText: rec.choice_text,
      reactionTime: rec.reaction_time_s,
      isGameOver: rec.is_game_over
    }));
  }, [analyticsData]);

  // Summarized metrics
  const summaryStats = useMemo(() => {
    if (!analyticsData) return { totalVotes: 0, avgTime: 0, totalNodes: 0 };
    
    const totalVotes = analyticsData.raw_records?.length || 0;
    const totalTime = analyticsData.raw_records?.reduce((sum, r) => sum + r.reaction_time_s, 0) || 0;
    const avgTime = totalVotes > 0 ? (totalTime / totalVotes).toFixed(2) : 0;
    
    const uniqueScenes = new Set(analyticsData.raw_records?.map(r => r.scene_title));
    
    return {
      totalVotes,
      avgTime,
      totalNodes: uniqueScenes.size
    };
  }, [analyticsData]);

  if (loading) {
    return (
      <div className="teacher-loading-screen">
        <div className="spinner"></div>
        <p>Procesando telemetría y construyendo grafos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="teacher-error-screen">
        <div className="error-icon">⚠️</div>
        <h3>No se pudieron cargar las analíticas</h3>
        <p>{error}</p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => window.location.reload()} 
            className="btn btn-analytics"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', border: 'none', color: '#fff', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reintentar Carga ↻
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn btn-secondary">
            Volver al Panel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-dashboard-container">
      {/* Header */}
      <header className="dashboard-header-bar">
        <div className="header-meta">
          <span className="badge-admin">VISTA PROFESOR (ADMIN)</span>
          <h1>Dashboard Analítico de Supervivencia</h1>
          <p>Historia: <strong>{analyticsData?.story_title}</strong> | Código de Sala: <strong>{roomPin}</strong></p>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn btn-back-lobby">
          ← Volver a Salas
        </button>
      </header>

      {/* KPI Overview Summary */}
      <div className="kpi-cards-grid">
        <div className="kpi-card">
          <span className="kpi-label">Nodos del Grafo Recorridos</span>
          <span className="kpi-value">{summaryStats.totalNodes}</span>
          <span className="kpi-subtitle">Escenas únicas exploradas</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Votos Totales Registrados</span>
          <span className="kpi-value">{summaryStats.totalVotes}</span>
          <span className="kpi-subtitle">Decisiones colectivas emitidas</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Tiempo de Reacción Promedio</span>
          <span className="kpi-value">{summaryStats.avgTime}s</span>
          <span className="kpi-subtitle">Velocidad de respuesta media</span>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="tabs-navigation">
        <button 
          onClick={() => setActiveTab('sankey')} 
          className={`tab-btn ${activeTab === 'sankey' ? 'active' : ''}`}
        >
          🌳 Árbol de Consenso (Sankey)
        </button>
        <button 
          onClick={() => setActiveTab('splits')} 
          className={`tab-btn ${activeTab === 'splits' ? 'active' : ''}`}
        >
          ⚖️ Puntos de Inflexión (Debate)
        </button>
        <button 
          onClick={() => setActiveTab('velocity')} 
          className={`tab-btn ${activeTab === 'velocity' ? 'active' : ''}`}
        >
          ⏱️ Velocidad y Resultados (Correlación)
        </button>
      </div>

      {/* Main Charts Viewport */}
      <div className="chart-viewport-card">
        {activeTab === 'sankey' && (
          <div className="tab-pane-content sankey-pane">
            <div className="pane-intro">
              <h3>El Árbol de Consenso Democrático</h3>
              <p>Mapea el flujo de alumnos a través del laberinto narrativo. El grosor del flujo es proporcional a la cantidad de alumnos. Los nodos <span className="text-danger">Rojos</span> son finales trágicos (Game Over) y los <span className="text-success">Verdes</span> representan caminos de supervivencia.</p>
            </div>
            
            {sankeyData.nodes.length === 0 ? (
              <div className="no-data-placeholder">Aún no hay suficiente telemetría de flujos para renderizar el Sankey.</div>
            ) : (
              <div className="sankey-chart-wrapper">
                <ResponsiveContainer width="100%" height={500}>
                  <Sankey
                    data={sankeyData}
                    nodeWidth={18}
                    nodePadding={24}
                    link={renderSankeyLink}
                    node={renderSankeyNode}
                  >
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          if (data.source !== undefined) {
                            // Link tooltip
                            return (
                              <div className="chart-custom-tooltip">
                                <p className="tooltip-title">Ruta del Grupo</p>
                                <p>{sankeyData.nodes[data.source].name} ➔ {sankeyData.nodes[data.target].name}</p>
                                <p><strong>{data.value} alumnos</strong> tomaron este camino</p>
                              </div>
                            );
                          } else {
                            // Node tooltip
                            return (
                              <div className="chart-custom-tooltip">
                                <p className="tooltip-title">{data.name}</p>
                                <p>Estado: <strong>{data.isGameOver ? 'Game Over ☠️' : 'Superviviencia/Tránsito ✅'}</strong></p>
                              </div>
                            );
                          }
                        }
                        return null;
                      }}
                    />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {activeTab === 'splits' && (
          <div className="tab-pane-content splits-pane">
            <div className="pane-intro">
              <h3>Puntos de Inflexión y Decisiones Divididas</h3>
              <p>Escenas críticas del juego donde el voto del alumnado estuvo más polarizado u empatado. Identificar estas decisiones divididas es fundamental para iniciar debates grupales pos-partida.</p>
            </div>

            {controversialDecisions.length === 0 ? (
              <div className="no-data-placeholder">No se encontraron decisiones con votos divididos.</div>
            ) : (
              <div className="splits-grid">
                {controversialDecisions.map((scene) => (
                  <div key={scene.scene_id} className="split-scene-card">
                    <div className="card-head">
                      <h4>{scene.scene_title}</h4>
                      <span className="split-badge">Diferencia: {scene.splitDiff}% (Casi Empate)</span>
                    </div>
                    <p className="total-votes-label">Votos recibidos: {scene.total_votes}</p>
                    
                    <div className="bar-chart-wrapper">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart
                          data={scene.choices}
                          margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis 
                            dataKey="choice_text" 
                            stroke="#9ca3af" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false}
                          />
                          <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="chart-custom-tooltip">
                                    <p className="tooltip-title">{data.choice_text}</p>
                                    <p>Votos: <strong>{data.votes}</strong> ({data.percentage}%)</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey="votes" radius={[6, 6, 0, 0]}>
                            {scene.choices.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={index % 2 === 0 ? '#60a5fa' : '#c084fc'} 
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'velocity' && (
          <div className="tab-pane-content velocity-pane">
            <div className="pane-intro">
              <h3>Correlación de Tiempos de Reacción</h3>
              <p>Muestra el tiempo de reacción individual en segundos por cada decisión tomada. Los puntos <span className="text-danger">Rojos</span> representan votos que llevaron a finales de Game Over, y los <span className="text-success">Verdes</span> a caminos correctos/supervivencia. Permite observar si las decisiones apresuradas o demoradas correlacionan con desenlaces trágicos.</p>
            </div>

            {scatterPlotData.length === 0 ? (
              <div className="no-data-placeholder">No hay suficientes registros de tiempos de reacción.</div>
            ) : (
              <div className="scatter-chart-wrapper">
                <ResponsiveContainer width="100%" height={400}>
                  <ScatterChart
                    margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      type="number" 
                      dataKey="reactionTime" 
                      name="Tiempo de Reacción" 
                      unit="s"
                      stroke="#9ca3af"
                      fontSize={11}
                      tickLine={false}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="sceneTitle" 
                      name="Escena" 
                      stroke="#9ca3af"
                      fontSize={10}
                      tickLine={false}
                      width={150}
                    />
                    <ZAxis type="number" range={[100, 100]} />
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="chart-custom-tooltip">
                              <p className="tooltip-title">Registro de Telemetría</p>
                              <p>Alumno: <strong>{data.participantName}</strong></p>
                              <p>Escena: <strong>{data.sceneTitle}</strong></p>
                              <p>Decisión: "{data.choiceText}"</p>
                              <p>Tiempo de respuesta: <strong>{data.reactionTime}s</strong></p>
                              <p>Resultado: <strong>{data.isGameOver ? 'Game Over ☠️' : 'Superviviencia ✅'}</strong></p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Scatter name="Votos individuales" data={scatterPlotData}>
                      {scatterPlotData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isGameOver ? '#ef4444' : '#22c55e'} 
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherDashboard;
