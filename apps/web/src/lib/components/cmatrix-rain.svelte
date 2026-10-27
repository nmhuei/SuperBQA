<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    opacity?: number
    speed?: number
    fontSize?: number
    color?: string
    headColor?: string
  }

  let {
    opacity = 0.2,
    speed = 1,
    fontSize = 15,
    color = '#00ff66',
    headColor = '#e0ffe0',
  }: Props = $props()

  let canvas: HTMLCanvasElement | null = $state(null)

  const CHARS =
    'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ010101010123456789ABCDEF<>{}[];:*#@!%^&|/\\~$_=+'

  interface MatrixDrop {
    y: number
    speed: number
    chars: string[]
  }

  onMount(() => {
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let animId: number
    let lastTime = performance.now()
    let width = 0
    let height = 0
    let columns = 0
    let drops: MatrixDrop[] = []

    const initGrid = () => {
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight

      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)

      columns = Math.floor(width / fontSize)
      drops = []
      for (let i = 0; i < columns; i++) {
        drops.push({
          y: Math.random() * -100,
          speed: (0.7 + Math.random() * 0.8) * speed,
          chars: Array.from({ length: 25 }, () =>
            CHARS.charAt(Math.floor(Math.random() * CHARS.length))
          ),
        })
      }
    }

    initGrid()
    window.addEventListener('resize', initGrid)

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.1)
      lastTime = time

      ctx.clearRect(0, 0, width, height)
      ctx.font = `${fontSize}px "Geist Mono", monospace`

      for (let i = 0; i < drops.length; i++) {
        const drop = drops[i]
        if (!drop) continue
        const x = i * fontSize

        for (let j = 0; j < drop.chars.length; j++) {
          const charY = (drop.y - j) * fontSize
          if (charY < -fontSize || charY > height + fontSize) continue
          const char = drop.chars[j] ?? '0'

          if (j === 0) {
            ctx.fillStyle = headColor
            ctx.shadowColor = color
            ctx.shadowBlur = 8
            ctx.fillText(char, x, charY)
            ctx.shadowBlur = 0
          } else {
            const alpha = Math.max(0, 1 - j / drop.chars.length)
            ctx.fillStyle = `rgba(0, 255, 102, ${alpha * 0.9})`
            ctx.fillText(char, x, charY)
          }

          if (Math.random() < 0.02) {
            drop.chars[j] = CHARS.charAt(
              Math.floor(Math.random() * CHARS.length)
            )
          }
        }

        drop.y += drop.speed * 28 * dt
        if (drop.y - drop.chars.length > height / fontSize) {
          drop.y = Math.random() * -20
          drop.speed = (0.7 + Math.random() * 0.8) * speed
        }
      }

      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', initGrid)
    }
  })
</script>

<canvas
  bind:this={canvas}
  class="cmatrix-bg"
  style="opacity: {opacity};"
  aria-hidden="true"
></canvas>

<style>
  .cmatrix-bg {
    position: fixed;
    inset: 0;
    inline-size: 100vw;
    block-size: 100vh;
    pointer-events: none;
    z-index: 0;
    user-select: none;
  }
</style>
