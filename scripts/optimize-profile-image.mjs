import sharp from "sharp";
import { resolve } from "node:path";

// Keep the original as the editable source; only create display-size derivatives.
const source = resolve("public/images/orbital/author-avatar.webp");
for (const width of [210, 420]) {
	const result = await sharp(source)
		.resize(width, width, { fit: "cover", withoutEnlargement: true })
		.webp({ quality: 82, effort: 6 })
		.toFile(resolve(`public/images/orbital/author-avatar-${width}.webp`));
	console.log(`Profile avatar ${width}px: ${result.size} bytes`);
}
