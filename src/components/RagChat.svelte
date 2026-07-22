<script lang="ts">
	let question = "";
	let answer = "";
	let sources: { title: string; url: string }[] = [];
	let loading = false;
	let error = "";
	let open = false;

	const apiBase = import.meta.env.PUBLIC_RAG_API_URL || "https://api.nyachen.cn";

	async function ask() {
		const value = question.trim();
		if (!value || loading) return;
		loading = true;
		error = "";
		answer = "";
		sources = [];
		try {
			const response = await fetch(`${apiBase}/chat`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ question: value }),
		});
			const data = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(data.error === "rate_limited" ? "请求过于频繁，请稍后再试。" : "助手暂时不可用，请稍后再试。");
			answer = data.answer || "没有得到回答。";
			sources = data.sources || [];
		} catch (e) {
			error = e instanceof Error ? e.message : "请求失败。";
		} finally {
			loading = false;
		}
	}
</script>

<div class="fixed bottom-4 right-4 z-50 w-[min( calc(100vw-2rem),28rem)]">
	{#if open}
		<section class="card-base mb-3 overflow-hidden shadow-xl" aria-label="博客知识库助手">
			<header class="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
				<div>
					<h2 class="font-bold">博客知识库助手</h2>
					<p class="text-xs opacity-60">仅根据本站文章回答</p>
				</div>
				<button class="btn-plain h-8 w-8" aria-label="关闭助手" on:click={() => (open = false)}>×</button>
			</header>
			<div class="max-h-[60vh] space-y-3 overflow-y-auto p-4">
				<textarea bind:value={question} maxlength="4000" rows="3" placeholder="例如：BSV 的 rule 和 Verilog 的 always_ff 有什么区别？" class="w-full resize-y rounded-lg border border-black/10 bg-transparent p-3 outline-none focus:border-[var(--primary)] dark:border-white/10"></textarea>
				<button class="btn-regular w-full" disabled={loading || !question.trim()} on:click={ask}>{loading ? "思考中…" : "提问"}</button>
				{#if error}<p class="text-sm text-red-600 dark:text-red-400">{error}</p>{/if}
				{#if answer}
					<article class="prose prose-sm max-w-none dark:prose-invert whitespace-pre-wrap">{answer}</article>
					{#if sources.length}
						<div class="border-t border-black/10 pt-3 text-xs dark:border-white/10"><strong>参考来源</strong><ol class="mt-1 list-decimal pl-5">{#each sources as source}<li><a class="hover:text-[var(--primary)]" href={source.url}>{source.title}</a></li>{/each}</ol></div>
					{/if}
				{/if}
			</div>
		</section>
	{/if}
	<button class="card-base float-right flex h-12 w-12 items-center justify-center text-xl shadow-lg transition hover:scale-105" aria-label={open ? "关闭知识库助手" : "打开知识库助手"} on:click={() => (open = !open)}>✦</button>
</div>
