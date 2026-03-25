import React, { useState, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";

const MAX_DISTANCE = 20;
const MAX_POLYS = 100;

export default function App() {
  const [polys, setPolys] = useState([[]]);
  const [mode, setMode] = useState("b");
  const [hovered, setHovered] = useState(null);
  const [activeKey, setActiveKey] = useState(null); // for key flash
  const [message, setMessage] = useState("");

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      const key = e.key.toLowerCase();
      if (["b", "d", "m", "r", "q"].includes(key)) {
        setActiveKey(key);
        setMode(key);

        // flash key briefly
        setTimeout(() => setActiveKey(null), 300);

        if (key === "r") setPolys([[]]); // refresh
        if (key === "q") window.close(); // quit
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const totalPoints = polys.reduce((sum, p) => sum + p.length, 0);
  const polyCount = polys.filter((p) => p.length > 0).length;

  const modes = [
    { key: "b", label: "DRAW" },
    { key: "d", label: "DELETE" },
    { key: "m", label: "MOVE" },
    { key: "r", label: "REFRESH" },
    { key: "q", label: "QUIT" },
  ];

  return (
    <>
      {/* Top bar: Key Legend */}
      <div style={{ 
          position: "absolute", top: 0, left: 0, right: 0, height: 40, 
          backgroundColor: "#EAF1F8", display: "flex", alignItems: "center", 
          justifyContent: "center", gap: 15, fontFamily: "monospace", fontWeight: "bold",
          zIndex: 9999, pointerEvents: "none"
        }}>
        {modes.map(({ key, label }) => (
          <div key={key} style={{
            padding: "4px 8px",
            border: "1px solid #1A3A5C",
            borderRadius: "4px",
            backgroundColor: activeKey === key ? "#2C5F8A" : "#fff",
            color: activeKey === key ? "#fff" : "#1A3A5C"
          }}>
            [{key}] {label}
          </div>
        ))}
      </div>

      {/* Status bar */}
      <div style={{
        position: "absolute",
        bottom: 10,
        left: "50%",
        transform: "translateX(-50%)",
        color: "#1A3A5C",
        background: "#EAF1F8",
        padding: "6px 12px",
        borderRadius: "6px",
        fontFamily: "Arial",
        display: "flex",
        gap: 20,
        zIndex: 9999,
        userSelect: "none"
      }}>
        <div style={{ color: mode === "b" ? "#2C5F8A" : mode === "m" ? "#E76F51" : mode === "d" ? "#E63946" : "#1A3A5C"}}>
          Mode: {modes.find(m => m.key === mode)?.label}
        </div>
        <div>Polylines: {polyCount}</div>
        <div>Points: {totalPoints}</div>
        {message && <div style={{ color: "red" }}>{message}</div>}
      </div>

      {/* Canvas */}
      <Canvas
        style={{
          width: "100vw",
          height: "100vh",
          border: mode === "b" ? "4px solid #2C5F8A" : "4px solid transparent",
          boxSizing: "border-box"
        }}
        camera={{ position: [0, 0, 100] }}
      >
        <color attach="background" args={["#F8F9FA"]} />
        <PointerHandler 
          polys={polys} 
          setPolys={setPolys} 
          hovered={hovered} 
          setHovered={setHovered} 
          mode={mode} 
          setMessage={setMessage}
        />
        <Scene polys={polys} hovered={hovered} mode={mode} />
      </Canvas>
    </>
  );
}

// --- Pointer events handler ---
function PointerHandler({ polys, setPolys, hovered, setHovered, mode, setMessage }) {
  const { camera, gl } = useThree();
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const [dragging, setDragging] = useState(null);

  const getMousePos = (event) => {
    const rect = gl.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const point = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, point);
    return { x: point.x, y: point.y };
  };

  const findNearest = (pos) => {
    let nearest = null;
    let minDist = Infinity;
    polys.forEach((poly, pi) => {
      poly.forEach((v, vi) => {
        const dist = Math.hypot(v.x - pos.x, v.y - pos.y);
        if (dist < minDist && dist < MAX_DISTANCE) {
          minDist = dist;
          nearest = { pi, vi };
        }
      });
    });
    return nearest;
  };

  const handlePointerDown = (e) => {
    const pos = getMousePos(e);

    if (mode === "b") {
      if (polys.length >= MAX_POLYS) {
        setMessage("Max polylines reached");
        setTimeout(() => setMessage(""), 1500);
        return;
      }
      setPolys(prev => {
        const copy = [...prev];
        if (!copy[copy.length - 1]) copy.push([]);
        copy[copy.length - 1].push(pos);
        return copy;
      });
    }

    if (mode === "d") {
      const nearest = findNearest(pos);
      if (!nearest) {
        setMessage("No vertex nearby — click closer");
        setTimeout(() => setMessage(""), 1500);
        return;
      }
      setPolys(prev => {
        const copy = [...prev];
        copy[nearest.pi].splice(nearest.vi, 1);
        if (copy[nearest.pi].length === 0) copy.splice(nearest.pi, 1);
        return copy.length ? copy : [[]];
      });
    }

    if (mode === "m") {
      const nearest = findNearest(pos);
      if (nearest) setDragging(nearest);
      else {
        setMessage("No vertex nearby — click closer");
        setTimeout(() => setMessage(""), 1500);
      }
    }
  };

  const handlePointerMove = (e) => {
    const pos = getMousePos(e);
    if (dragging) {
      setPolys(prev => {
        const copy = [...prev];
        copy[dragging.pi][dragging.vi] = pos;
        return copy;
      });
    } else {
      setHovered(findNearest(pos));
    }
  };

  const handlePointerUp = () => {
    if (dragging) setDragging(null);
  };

  return (
    <mesh
      position={[0, 0, 0]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <planeGeometry args={[10000, 10000]} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

// --- Scene renders polylines ---
function Scene({ polys, hovered, mode }) {
  return (
    <group>
      {polys.map((poly, i) => (
        <Polyline key={i} points={poly} hovered={hovered} polyIndex={i} mode={mode} />
      ))}
    </group>
  );
}

// --- Polyline component with lines and points ---
function Polyline({ points, hovered, polyIndex, mode }) {
  const linePoints = points.map(p => new THREE.Vector3(p.x, p.y, 0));
  const geometry = new THREE.BufferGeometry().setFromPoints(linePoints);

  return (
    <>
      {points.length > 1 && (
        <line geometry={geometry}>
          <lineBasicMaterial attach="material" color="#1A3A5C" />
        </line>
      )}

      {points.map((p, i) => {
        let color = "#2C5F8A"; // default
        let radius = 5;

        if (hovered && hovered.pi === polyIndex && hovered.vi === i) {
          if (mode === "m") { color = "#E76F51"; radius = 7; }
          if (mode === "d") { color = "#E63946"; radius = 7; }
        }

        return (
          <mesh key={i} position={[p.x, p.y, 0]}>
            <circleGeometry args={[radius, 16]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </>
  );
}