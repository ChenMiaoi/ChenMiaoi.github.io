/**
 * Central glossary for the hover-tooltip feature (see src/plugins/remark-glossary.mjs).
 *
 * - `term` is the canonical name shown in the tooltip data attribute.
 * - `aliases` lists other surface forms that should also be matched.
 * - `definitions` maps a normalized language code ("zh", "en", ...) to a
 *   single-line explanation. Keep each definition on one line — it is rendered
 *   into a `data-definition` HTML attribute.
 *
 * The tooltip language is picked per post from its frontmatter `lang`,
 * falling back to the site language, then "en", then the first available one.
 */
export interface GlossaryEntry {
	term: string;
	aliases?: string[];
	definitions: Record<string, string>;
}

export const glossary: GlossaryEntry[] = [
	{
		term: "Leader Election",
		aliases: ["electing a leader", "leader election"],
		definitions: {
			zh: "领导者选举：Raft 等共识算法中，集群通过投票在多个节点中选出一个 Leader，由它统一处理客户端请求并协调日志复制。",
			en: "Leader election: in consensus algorithms such as Raft, cluster nodes vote to choose a single leader that handles client requests and coordinates log replication.",
		},
	},
	{
		term: "Log Replication",
		aliases: ["replicated log", "log entries"],
		definitions: {
			zh: "日志复制：Leader 将客户端请求作为日志条目追加到本地日志，并复制到多数派节点后才提交，从而保证各节点状态一致。",
			en: "Log replication: the leader appends client requests to its log and replicates them to a majority of nodes before committing, keeping all state machines consistent.",
		},
	},
	{
		term: "State Machine",
		aliases: ["state machine", "状态机"],
		definitions: {
			zh: "状态机：由一组状态及状态间转移构成的计算模型。在分布式系统中常指状态机复制——各节点按相同顺序应用相同日志，从而到达一致状态。",
			en: "State machine: a computation model of states and transitions. In distributed systems it usually means a replicated state machine, where every node applies the same log entries in the same order.",
		},
	},
	{
		term: "Virtual Memory",
		aliases: ["virtual memory", "虚拟内存"],
		definitions: {
			zh: "虚拟内存：为每个进程提供独立的地址空间，经 MMU 与页表映射到物理内存，实现隔离、保护与按需分页。",
			en: "Virtual memory: gives each process an isolated address space, mapped to physical memory by the MMU via page tables, enabling isolation and demand paging.",
		},
	},
	{
		term: "System Call",
		aliases: ["system call", "syscall", "系统调用"],
		definitions: {
			zh: "系统调用：用户态程序通过陷入（如 RISC-V 的 ecall 指令）请求内核服务的接口，是用户态与内核态的分界。",
			en: "System call: the interface through which user programs trap into the kernel (e.g. the ecall instruction on RISC-V) to request privileged services.",
		},
	},
];
