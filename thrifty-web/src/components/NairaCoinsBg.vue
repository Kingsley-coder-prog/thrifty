<template>
  <canvas
    ref="canvasRef"
    class="absolute inset-0 w-full h-full"
    aria-hidden="true"
  />
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const canvasRef = ref(null);
let animationId = null;

onMounted(() => {
  const canvas = canvasRef.value;
  const ctx = canvas.getContext("2d");

  const resize = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  const coins = Array.from({ length: 28 }, () => ({
    x: 30 + Math.random() * (canvas.width - 60),
    y: canvas.height + Math.random() * 200,
    r: 10 + Math.random() * 14,
    speed: 0.4 + Math.random() * 0.6,
    opacity: 0.1 + Math.random() * 0.22,
    wobble: Math.random() * Math.PI * 2,
    wobbleSpeed: 0.015 + Math.random() * 0.025,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.02,
  }));

  function drawCoin(x, y, r, rotation, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(x, y);
    ctx.rotate(rotation);
    const scaleY = 0.5 + 0.5 * Math.abs(Math.cos(rotation));
    ctx.scale(1, scaleY);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = "#fbbf24";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#d97706";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2);
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = "#92400e";
    ctx.font = `bold ${r * 0.9}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("₦", 0, 0);

    ctx.restore();
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    coins.forEach((c) => {
      c.y -= c.speed;
      c.wobble += c.wobbleSpeed;
      c.rotation += c.rotSpeed;
      const wx = c.x + Math.sin(c.wobble) * 10;

      if (c.y < -c.r * 2) {
        c.y = canvas.height + 20 + Math.random() * 80;
        c.x = 30 + Math.random() * (canvas.width - 60);
      }

      drawCoin(wx, c.y, c.r, c.rotation, c.opacity);
    });

    animationId = requestAnimationFrame(animate);
  }

  animate();

  onUnmounted(() => {
    cancelAnimationFrame(animationId);
    window.removeEventListener("resize", resize);
  });
});
</script>