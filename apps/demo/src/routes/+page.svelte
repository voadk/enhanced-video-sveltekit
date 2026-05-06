<h1>enhanced-video demo</h1>

<p>This page renders a single <code>&lt;enhanced:video&gt;</code> tag. Watch the network tab to see the AV1 (<code>.webm</code>) source on Chrome and the H.264 (<code>.mp4</code>) fallback on Safari.</p>

	<enhanced:video src="$lib/clip2.mov" autoplay muted loop playsinline />
	<enhanced:video src="$lib/clip.mp4" autoplay muted loop playsinline />
	<enhanced:video src="$lib/videoplayback.mp4" autoplay muted loop playsinline />
