import postcssImport from "postcss-import";
import postcssNesting from "tailwindcss/nesting/index.js";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

export default {
	plugins: [postcssImport(), postcssNesting(), tailwindcss(), autoprefixer()],
};
