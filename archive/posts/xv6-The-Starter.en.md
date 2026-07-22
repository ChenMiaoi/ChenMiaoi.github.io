---
slug: xv6-The-Starter.en
title: 'xv6: The Starter'
published: 2024-05-16
tags:
  - xv6
  - os
  - risc-v
category: xv6
series: xv6
lang: "en"
---
> In the previous section, we learned how `xv6-riscv` boots the kernel from `qemu` to a designated entry point, and how it jumps from that entry point into the specific `start` function. Now, let's analyze how the `start` function works.

## Start Function

Before we begin, we need to know that in the `start` function, **we have not yet truly entered the kernel**. What does that mean? In fact, the `start` **function is actually still part of the boot program; its ultimate goal is to jump to** `main`**, thereby entering kernel-mode execution**. Also, a most basic fact: the kernel mode of `xv6-riscv` runs in `S` mode, not `M` mode, so when we jump from the entry point into the `start` function, it is still in `M` mode. In other words, another purpose of the `start` **function is to set up a suitable environment configuration for entering** `main`.

Therefore, a question naturally arises here: **how do we drop from** `M` **mode into** `S` **mode?** Now, let's learn some knowledge about `risc-v privilege`.

### mstatus csr(Machine Status Register)

The `mstatus` register is an `MXLEN`-bit readable/writable register **that tracks and controls the current operating state of a** `hart`. In other words, by modifying certain bits of `mstatus`, we can change the current operating state of the `hart`. The formats of `rv32 mstatus` and `rv64 mstatus` are given below:

![risc-v32 mstatus](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161531613.png)

![risc-v64 mstatus](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161533069.png)

Here, I **do not intend to cover all the flag bits of** `mstatus` **in full; I will only introduce the flag bits involved in this section**.

Global interrupt-enable flags: `MIE` and `SIE`, used for `M-mode` and `S-mode` respectively. These bits are mainly used to ensure the atomicity of interrupt handlers in the current privilege mode; in other words: **set** `xIE` **to handle** `M`-mode or `S`-mode interrupts. Moreover, they can be set by a single **`csr` instruction**.

When a `hart` executes at privilege level $x$: when $xIE = 1$, interrupts are globally enabled; when $xIE = 0$, interrupts are globally disabled. For interrupts at a lower privilege level: if $x \gt w$, then regardless of what $wIE$ the lower privilege level has set, they are always globally disabled; for interrupts at a higher privilege level: if $y \ge x$, then regardless of anything, they are always globally enabled. How to understand this: **viewed from a higher privilege level looking at a lower privilege level, the interrupt settings of the lower privilege level have no effect on the higher privilege level; viewed from a lower privilege level looking at a higher privilege level, the higher privilege level is always enabled**.

In other words, the actual `riscv` privilege levels have the following rule: **a higher privilege level can always interrupt a lower privilege level**. At the same time, this provides an advantage: **higher-privilege code can use the individual interrupt enables to disable selected higher-privilege interrupts, and then hand control over to a lower privilege level**. Recall our goal: we need to switch from `M` mode to `S` mode, and the kernel mode resides permanently in `S` mode. Therefore, **we do not want `M`-mode interrupts to be triggered frequently, forcibly interrupting the kernel's tasks and reducing efficiency**, so we need to configure the interrupt bits (introduced later).

To support nested `trap`s, every privilege mode $x$ that can respond to interrupts has a two-level stack containing the interrupt-enable bit and the privilege mode. $xPIE$ **holds the value of the interrupt-enable bit that was active before the** `trap` **occurred, while** $xPP$ holds the previous privilege mode.

> Two-level Stack  
> The two-level stack refers to a stack structure with two levels, used to store the interrupt-enable bit and the privilege mode. The first level stores the current interrupt-enable bit and privilege mode, and the second level stores the interrupt-enable bit and privilege mode saved while handling an interrupt.

The $xPP$ field can only hold privilege modes up to $x$, so `MPP` is two bits wide, while `SPP` has only one bit. When a `trap` is taken from privilege mode $y$ into privilege mode $x$, $xPIE$ is set to the value of $xIE$, $xIE$ is cleared to zero, and meanwhile, $xPP = y$.

**For lower privilege levels, any** `trap` (**synchronous or asynchronous**) **is usually taken into a higher privilege mode with interrupts *disabled* upon entry. The higher-privilege** `trap` **handler will handle the** `trap` **and return using the stacked information, or, if it does not immediately return to the interrupted context, will save the privilege stack before re-enabling interrupts, so each stack only needs one entry**.

By now, only one question remains: how does a higher privilege level return to a lower privilege level?

The `MRET` or `SRET` instruction answers this question; `MRET` or `SRET` is used to return from a `trap` in `M` mode or `S` mode respectively. Suppose $xPP = y$: when an $xRET$ instruction is executed, then $xIE = xPIE$, the privilege mode is set to $y$, $xPIE = 1$, and $xPP$ is set to the least-privileged mode (`U mode`, or `M` if `U` is not implemented). Furthermore, if $y \ne M \rightarrow MPRV = 0$.

Let me briefly explain the meaning of the above sentence: when the `xRET` instruction executes, `xPIE` and `xPP`, which hold the previous privilege information, take effect. After its assignment is complete, `xPIE` is set to `1`, because **interrupts at higher privilege levels are always enabled**. `MPRV` indicates the privilege mode used for memory accesses. If the returned privilege mode `y` is not `M`, `MPRV` is set to `0`. This means memory accesses will no longer use `M mode`, but will use the current privilege mode instead.

What is harder to understand is why `xPP` is set to the least-privileged mode. Setting `xPP` to the least-privileged mode **helps identify software errors in the management of the two-level privilege stack**.

It is worth noting that the `xPP` field is a `WARL` field, **which can only hold privilege mode** $x$ **or any implemented privilege mode lower than** $x$. **If privilege mode** $x$ **is not implemented**, **then the $xPP$ field must be read-only** $0$.

> WARL(Write Any Values, Reads Legal Values)  
> Some read/write `CSR` fields are only defined for a specific subset of bit encodings, but allow any value to be written while guaranteeing that a legal value is returned when read. Assuming writing the `CSR` has no other side effects, the range of supported values can be determined by attempting to write a desired setting and then reading it back to see whether the value was retained. These fields are marked as `WARL(Write-Any Read-Legal)` in register descriptions.  
> An implementation will not raise an exception because an unsupported value is written to a `WARL` field. When reading a `WARL` field, if the last value written was an illegal value, the implementation may return any legal value, but the returned legal value should have a deterministic relationship with the illegal value written and the architectural state of the `hart`.

### mepc csr(Machine Exception Program Counter)

Here, I will not introduce all the uses of `mepc` in detail, and will only mention one point: **when the** `start` **function calls** `mret`, **the value of** `mepc` **should be set to the address of the** `main` **function**.

A more formal usage can be given here: when a `trap` is taken into `M` mode, `mepc` is written with the virtual address of the instruction that raised the interrupt or encountered the exception. Therefore, when `mret` is called, the jump is made according to the value of `mepc`.

![mepc](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161703495.png)

### satp(Supervisor Address Translation and Protection Register)

The `satp` register is an `SXLEN`-bit readable/writable register that controls address translation and protection in `S` mode. `satp` has two forms, corresponding to $SXLEN = 31$ or $SXLEN = 64$:

![SXLEN = 32](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161825930.png)

![SXLEN = 64](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161826849.png)

The `satp` register contains the physical page number (`PPN, Physical Page Number`) of the root page table, which is derived by dividing the `S mode` physical address by $4 KiB$; an address space identifier (`ASID, Address Space Identify`), which facilitates address-translation fences (`fence`) on a per-address-space basis; and a mode (`MODE`) field, which determines the current address translation scheme.

Among these, the `MODE` field needs a detailed introduction. When $MODE = Bare$, virtual addresses in `S` privilege mode are directly equivalent to physical addresses, with no additional memory protection beyond the physical memory protection scheme. To select $MODE = Bare$, software **must** zero the **remaining fields** of `satp`. **Attempting to use a non-zero** `satp` **with $MODE = Bare$ has an** `UNSPECIFIED` **effect on the values of the fields that were not zeroed, and has an** `UNSPECIFIED` **effect on address translation and protection behavior**.

When $SXLEN = 32$, the only valid setting of `MODE` is `Sv32`, a virtual-memory paging scheme. When $SXLEN = 64$, there are three virtual-memory paging schemes to choose from: `Sv39`, `Sv48`, and `Sv57`. The remaining `MODE` settings are reserved for future use and may define different interpretations of the other fields in `satp`.

![satp mode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161850259.png)

The `satp` **register is only considered active in** `S mode` and `U mode`. The address translation algorithm can only begin execution with a given `satp` value when `satp` is active.

### medeleg & mideleg csr(Machine Trap Delegation Registers)

**By default, all** `trap`s **from any privilege level are handled in** `M mode`, **though the** `M mode` **handler can use the** `MRET` **instruction to redirect the** `trap` **back to the appropriate privilege level**.

To improve performance, an implementation can provide individual read/write bits in `medeleg` and `mideleg` to indicate that certain exceptions and interrupts should be handled directly by a lower privilege level. `medeleg(machine exception delegation)` is a $64$-bit readable/writable register; while `mideleg(machine interrupt delegation)` is an `MXLEN`-bit readable/writable register.

![medeleg](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161903945.png)

![mideleg](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161904480.png)

On a `hart` with `S mode`, `medeleg` and `mideleg` **must exist, and when a corresponding** `trap` **occurs in** `S mode` or `U mode`, **setting a bit in** `medeleg` or `mideleg` **delegates that** `trap` **to the** `trap handler` **in** `S mode`.

When a `trap` is delegated to `S mode`, the following operations are performed:

- `scause` is written with the cause of the `trap`
- `sepc` is written with the virtual address of the instruction that raised the `trap`
- `stval` is written with exception-specific data
- the `SPP` field of the `mstatus` register is written with the privilege mode active when the `trap` occurred
- the `SPIE` field of the `mstatus` register is written with the value of the `SIE` field when the `trap` occurred
- the `mstatus.SIE` field is cleared to zero
- `mcause`, `mepc`, `mtval`, and the `mstatus.MPP` and `mstatus.MPIE` fields are not written

It is worth noting: a `trap` **can never be taken from a higher privilege level to a lower privilege level; this situation does not occur**. It can only happen horizontally, that is: if `M mode` delegates a `trap` to `S mode`, then the exception-raising `trap` can be handled in `S mode`.

### Supervisor Interrupt Registers(sip and sie)

In this section, the `sip` register will not be introduced, because the focus here is the `sie` register.

The `sie` register is an $SXLEN$-bit readable/writable register that contains interrupt-enable bits. Interrupt cause numbers correspond to bit positions in `sie`. Bits `15:0` are allocated only to standard interrupt causes, while bits `16` and above are designated for platform use.

![sie](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161929965.png)

![scause values](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161929250.png)

![sie portion](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161931972.png)

- `sie.SSIE` is the interrupt-enable bit for `S mode` external interrupts
- `sie.STIP` is the interrupt-enable bit for `S mode` timer interrupts
- `sie.SEIE` is the interrupt-enable bit for `S mode` software interrupts
- If the `Sscofpmf` extension is implemented, `sie.LCOFIE` is the interrupt-enable bit for local counter-overflow interrupts. If the extension is not implemented, `sie.LCOFIE` is read-only `0`

### Physical Memory Protection CSRs

Only two registers are introduced here: `pmpcfg0` and `pmpaddr0`.

A `PMP(Physical Memory Protection)` entry is described by an `8`-bit configuration register and an `MXLEN`-bit address register. Some `PMP` settings also use the address register associated with the preceding `PMP` entry. Up to `64` `PMP` entries are supported. An implementation may implement `0`, `16`, or `64` `PMP` entries; **the lowest-numbered** `PMP` **entries must be implemented first**. All `PMP CSR` fields are `WARL` and may be read-only zero. `PMP CSR`s **are only accessible in** `M mode`.

`PMP configuration` registers are densely packed into `CSRs` **to minimize context-switch time**. For `RV32`, there are sixteen `CSRs(pmpcfg0–pmpcfg15)`, used to hold the configurations of `64` `PMP` entries `(pmp0cfg–pmp63cfg)`. For `RV64`, there are eight even-numbered `CSRs(pmpcfg0, pmpcfg2, ..., pmpcfg14)`, used to hold the configurations of `64` `PMP` entries. For `RV64`, **the odd-numbered configuration registers** `(pmpcfg1, pmpcfg3, ..., pmpcfg15)` **are illegal**.

![rv32 pmp configuration](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161949274.png)

![rv64 pmp configuration](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161950438.png)

The `PMP address` registers are `CSRs` named `pmpaddr0-pmpaddr63`. Each `PMP address` register encodes bits `33` through `2` of a `34`-bit physical address in `RV32`. For `RV64`, each `PMP address` register encodes bits `55` through `2` of a `56`-bit physical address. **Not all physical address bits need to be implemented**, so the `pmpaddr` registers are `WARL`.

![rv32 pmp address](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161954317.png)

![rv64 pmp address](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161954318.png)

The figure below shows the layout of a `PMP configuration` register. The `R`, `W`, and `X` bits indicate that the `PMP` entry permits **reads**, **writes**, and **instruction execution**, respectively. **When one of these bits is cleared, the corresponding access type is denied**. The `R`, `W`, and `X` fields form a collective `WARL` field, in which the combination $R = 0$ and $W = 1$ is reserved. The remaining two fields, `A` and `L`, are described in later chapters.

![pmp configuration layout](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161957353.png)

### Start Code

So far, the prerequisite knowledge for understanding the logic of the `start` function has been fully introduced. Now let's analyze the concrete contents of the `start` function:

```c
#define MSTATUS_MPP_MASK (3L << 11)
#define MSTATUS_MPP_S (1L << 11)
r_mstatus => asm volatile("csrr %0, mstatus" : "=r"(x));
r_mstatus => asm volatile("csrw mstatus, %0" : : "r"(x));

unsigned long x = r_mstatus();
x &= ~MSTATUS_MPP_MASK;
x |= MSTATUS_MPP_S;
w_mstatus(x);
```

This is the first operation from the entry point `_entry` into the `start` function. As we already know: the ultimate goal of the `start` function is to jump into the `main` function, performing a series of configurations beforehand, and then enter kernel mode. Now, the kernel mode of `xv6-riscv` runs in `S mode`, while at the moment we enter `start` from `_entry`, we are in `M mode`. Therefore, we need to set the privilege level that will be in effect after entering the `main` function.

`r_mstatus` reads the current `hart`'s operating state, while `x &= ~MSTATUS_MPP_MASK` performs a clearing operation on `mstatus.MPP`, and then `x |= MSTATUS_MPP_S` sets `mstatus.MPP = S`. In this way, after the `mret` instruction, we can set the privilege level to `S`.

However, we notice: **we have only finished setting the privilege level, but have not yet set where exactly to jump to**. Therefore:

```c
w_mepc((uint64)main);
```

As we learned above, the return address of `mret` is determined by the `mepc` register. Therefore, by setting the value of `mepc` to the address of the `main` function, we can jump to the corresponding `main` function when `mret` executes, thereby entering kernel mode.

In this way, we have completed a simple entry into kernel mode. However, for an `xcv6-riscv`, some specific handling is still required:

```c
// disable paging for now.
w_satp(0);

// delegate all interrupts and exceptions to supervisor mode.
w_medeleg(0xffff);
w_mideleg(0xffff);
w_sie(r_sie() | SIE_SEIE | SIE_STIE | SIE_SSIE);

// configure Physical Memory Protection to give supervisor mode
// access to all of physical memory.
w_pmpaddr0(0x3fffffffffffffull);
w_pmpcfg0(0xf);

// ask for clock interrupts.
timerinit();

// keep each CPU's hartid in its tp register, for cpuid().
int id = r_mhartid();
w_tp(id);
```

Let's analyze the meaning of this code line by line:

We know the `satp` register is used to manage the page-table base address, the address space identifier, and to enable or disable the paging mechanism. Thinking about it simply: **in the early stage of OS initialization, we do not need to bring up too many things, and since some configurations require direct access to physical memory, if the paging mechanism were enabled, page-table translation would be needed, and we would waste a certain amount of resources on extra initialization work during the initialization phase**. Setting $satp = 0$ here simplifies memory management and avoids doing paging management too early; the paging mechanism can be enabled later to support virtual memory after entering kernel mode.

`medeleg` and `mideleg` exist to improve efficiency, because frequently handling `trap`s through `M mode` would greatly affect the kernel's operation. Therefore, here we directly delegate all exceptions and interrupts to `S mode` for handling. In other words, kernel mode has full handling capability for `trap`s, which also matches common understanding: the kernel handles user exceptions and interrupts rather than leaving them to `M mode`.

Now we have handed the handling of `trap`s over to `S mode`, but we need to explicitly enable the interrupt enables at the `S` privilege level. Therefore, `w_sie(r_sie() | SIE_SEIE | SIE_STIE | SIE_SSIE)` **allows kernel mode to respond to external interrupts, timer interrupts, and software interrupts**. This also corresponds to `M mode` fully delegating the handling of `trap`s to kernel mode above.

Once we have handling permissions, we can consider memory access. In the [previous section](/en/2024/05/15/xv6-The-boot-loader/), we learned about the memory layout of `xv6-riscv`; its physical addresses are $56$ bits wide. Therefore, `w_pmpaddr0(0x3fffffffffffffull)` sets the address register of the first `PMP` entry to `0x3fffffffffffff`, which exactly covers the entire physical address space, so this entry can match any physical address. And `w_pmpcfg0(0xf)` configures this entry concretely, granting `S mode` **read, write, and execute access to the entire physical address space**.

`timerinit()` sets up the timer interrupt source, allowing `xv6-riscv` to obtain time slices.

The last step is to obtain the current `hart`'s `ID` and write it into the `tp` register. The `tp` register is used to store the thread pointer, i.e., the current execution flow `ID`.

## Timer

### CLINT

In `risc-v`, the definition of `CLINT` is implemented specifically by the platform, and `qemu virt` follows the `CLINT` design of `SIFIVE`. Therefore, here I refer to the `SiFive FE310-G000` development board for analysis.

The `CLINT` of `xv6-riscv` follows the settings in [qemu virt](https://github.com/qemu/qemu/blob/master/hw/riscv/virt.c), so you can see that the base address of `CLINT` is located at `0x2000'0000`.

```c
static const MemMapEntry virt_memmap[] = {
    [VIRT_CLINT] =        {  0x2000000,       0x10000 },
};
```

Having learned the base address of `CLINT` in actual physical addresses, we now need to learn some basic concepts about `CLINT`:

`CLINT(Core Local Interruptor)` is an internal processor module **responsible for handling and managing core-local interrupts and timer functions**. The main functions of `CLINT` include:

- `Local Interrupt Management`: `CLINT` handles core-local interrupt requests, which usually do not need to be processed through a global interrupt controller (such as the `PLIC, Platform-Level Interrupt Controller`). The interrupts **managed by `CLINT` are usually special in-core events**, such as software interrupts and timer interrupts.
- `Timer Functionality`: `CLINT` **provides core-local timer functionality, used to generate periodic interrupts**. Each processor core has an independent timer, and the timer's trigger time can be set by programming. **When the timer reaches the set time, an interrupt is triggered, and the processor core can use this interrupt to perform periodic tasks or carry out time management**.

In `risc-v`, operating the `CLINT` involves dedicated registers:

- `msip(Machine-mode Software Interrupt Pending Register)`: used to manage software interrupts. Each core has its own `msip` register. Writing to this register triggers a machine-mode software interrupt (`Machine Software Interrupt`) on the corresponding core.
- `mtime(Machine Timer Register)`: this is a 64-bit timer register, **used to track time**. **It is usually supplied with timestamps by a global, uniformly incrementing timer hardware unit**.
- `mtimecmp(Machine Timer Compare Register)`: each processor core has an independent $64$-bit `mtimecmp` register. The processor core continuously compares the values of `mtime` and `mtimecmp`; when `mtime` reaches or exceeds the value of `mtimecmp`, a machine-mode timer interrupt (`Machine Timer Interrupt`) is triggered.

The `risc-v` manual does not give detailed defined addresses for the `CLINT`'s dedicated registers, so by referring to the `SiFive FE310-G000` we can obtain their mapped addresses in the physical address space:

![CLINT register remap](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405171437088.png)

```c
// core local interruptor (CLINT), which contains the timer.
#define CLINT 0x2000000L
#define CLINT_MTIMECMP(hartid) (CLINT + 0x4000 + 8 * (hartid))
#define CLINT_MTIME (CLINT + 0xBFF8) // cycles since boot.
```

- `CLINT`: the base address of `CLINT`, i.e., the starting address of the `CLINT` registers.
- `CLINT_MTIMECMP(hartid)`: used to compute the address of the `MTIMECMP` register for a given `hartid`. In `CLINT`, each `hart` has an `MTIMECMP` register, used to set the time comparison value at which a timer interrupt fires.
- `CLINT_MTIME`: the address used to access the `MTIME` register. The `MTIME` register tracks the number of clock cycles since boot and is typically used to implement timers.

Before formally introducing the `Timer` code, we need to understand a few registers.

### mscratch csr(Machine Scratch Register)

The `mscratch` register is an $MXLEN$-bit readable/writable register **that can only be used by** `M mode`. **Typically, it is used to hold a pointer to the** `M mode` `hart-local` **context space, and is swapped with a user register upon entry to the** `M mode trap handler`.

When the processor enters machine mode to handle an interrupt or exception, it typically uses the `mscratch` register to save context information, such as the current register state, program counter, and so on. This allows the processor state to be restored after the interrupt or exception has been handled.

### mtvec csr(Machine Trap-Vector Base-Address Register)

The `mtvec` register is an $MXLEN$-bit readable/writable register **that holds a** `trap vector configuration` **consisting of a vector base address** (`Vector Base Address`) **and a vector mode** (`Vector Mode`).

![mtvec](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405171455924.png)

`mtvec` is always implemented and contains at least a readable value; if `mtvec` is implemented as writable, the set of values that `mtvec` can hold varies by implementation. The value of `mtvec.BASE` must always be four-byte aligned, while the setting of `mtvec.MODE` may impose additional alignment constraints on `mtvec.BASE`.

![Encoding of mtvec MODE field](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405171502892.png)

The encoding of `mtvec.MODE` is shown above. When $mtvec.MODE = Direct$, all `trap`s into `M` mode cause `pc` to be set to the value in the `mtvec.BASE` field; when `mtvec.MODE = Vectored`, all **synchronous exceptions** into `M` mode cause `pc` to be set to the value in the `mtvec.BASE` field, while all **asynchronous interrupts** into `M` mode cause `pc` to be set to $mtvec.BASE + cause \times 4$.

### Supervisor Interrupt Registers(sip and sie)

When introducing the `start` function, we already covered the `sie` register. Now, we introduce the `sip` register.

The `sip` register is an $SXLEN$-bit readable/writable register **that contains information about pending interrupts**.

![sip](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405171514872.png)

![scause values](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405161929250.png)

![sip portion](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202405171519208.png)

- `sip.SEIP` is the interrupt-pending bit for `S`-mode external interrupts. If implemented, `SEIP` is **read-only** in `sip` and is set and cleared by the execution environment, typically through a platform-specific interrupt control
- `sip.STIP` is the interrupt-pending bit for `S`-mode timer interrupts. If implemented, `STIP` is **read-only** in `sip` and is set and cleared by the execution environment
- `sip.SSIP` is the interrupt-pending bit for `S`-mode software interrupts. If implemented, `SSIP` is **writable** in `sip` and may be set to `1` by a platform-specific interrupt controller

### Timer Code

#### Timer Init

```c
// a scratch area per CPU for machine-mode timer interrupts.
uint64 timer_scratch[NCPU][5];

void timerinit() {
  // each CPU has a separate source of timer interrupts.
  int id = r_mhartid();

  // ask the CLINT for a timer interrupt.
  int interval = 1000000; // cycles; about 1/10th second in qemu.
  *(uint64 *)CLINT_MTIMECMP(id) = *(uint64 *)CLINT_MTIME + interval;

  // prepare information in scratch[] for timervec.
  // scratch[0..2] : space for timervec to save registers.
  // scratch[3] : address of CLINT MTIMECMP register.
  // scratch[4] : desired interval (in cycles) between timer interrupts.
  uint64 *scratch = &timer_scratch[id][0];
  scratch[3] = CLINT_MTIMECMP(id);
  scratch[4] = interval;
  w_mscratch((uint64)scratch);

  // set the machine-mode trap handler.
  w_mtvec((uint64)timervec);

  // enable machine-mode interrupts.
  w_mstatus(r_mstatus() | MSTATUS_MIE);

  // enable machine-mode timer interrupts.
  w_mie(r_mie() | MIE_MTIE);
}
```

Let's analyze the above code line by line: first, obtain the current `hartid`, to facilitate the subsequent calculation of `CLINT`-related information;

Then `*(uint64 *)CLINT_MTIMECMP(id) = *(uint64 *)CLINT_MTIME + interval`: sets up a timer interrupt in `CLINT`. This line sets the value of the `CLINT`'s `MTIMECMP` register (**used to set the time comparison value at which a timer interrupt fires**) to the current `MTIME` register value plus a specified interval. Here, the interval is $100'0000$ `CPU` cycles, roughly equivalent to $1/10$ of a second in `qemu`.

`uint64 *scratch = &timer_scratch[id][0]`: creates a pointer to the `timer_scratch` array and sets it to the address of the context corresponding to the current `hart`. This array is used to store some information related to timer interrupts.

`scratch[3] = CLINT_MTIMECMP(id)`: stores the address of the `CLINT`'s `MTIMECMP` register in the `3`rd entry of the `scratch` array.

`scratch[4] = interval`: stores the time interval between timer interrupt triggers (expressed in `CPU` cycles) in the `4`th entry of the `scratch` array.

`w_mscratch((uint64)scratch)`: stores the address of the `scratch` array in the `MSRATCH` register for subsequent handling. This actually initializes the timer interrupt information and saves it in the current `hart`'s context.

In other words, in `timer init`, we created a timer context configuration specific to each individual `hart`, as shown below:

```c
timer scratch[5] = {
    0,  reserve for parameters 
    8,  reserve for parameters 
    16, reserve for parameters 
    24, address of CLINT MTIMECMP register
    32, desired interval (in cycles) between timer interrupts
}
```

`w_mtvec((uint64)timervec)`: sets the `M mode trap` vector base address register (`MTVEC`) to the address of the `timervec` function. This means that when an `M mode` `trap` occurs, the processor jumps into the `timervec` function to execute the corresponding handling. For timer interrupts, we set it as the `M mode trap handler`, so whenever a timer interrupt occurs, it can jump into `timervec` for handling.

`w_mstatus(r_mstatus() | MSTATUS_MIE)`: enables `M mode` interrupts (`MIE`). This line sets the `MIE` bit of the `MSTATUS` register to `1`, allowing `M mode` interrupts.

`w_mie(r_mie() | MIE_MTIE)`: enables machine-mode timer interrupts (`MTIE`). This line sets the `MTIE` bit of the `MIE` register to `1`, allowing machine-mode timer interrupts, which corresponds to the code above.

#### Time Interrupt Handler

Actually, I think presenting the `Timer Trap Handler` here is not quite appropriate, so I will only list the code here without any explanation.

```asm
.globl timervec
.align 4
timervec:
        csrrw a0, mscratch, a0
        sd a1, 0(a0)
        sd a2, 8(a0)
        sd a3, 16(a0)

        # schedule the next timer interrupt
        # by adding interval to mtimecmp.
        ld a1, 24(a0) # CLINT_MTIMECMP(hart)
        ld a2, 32(a0) # interval
        ld a3, 0(a1)
        add a3, a3, a2
        sd a3, 0(a1)

        # arrange for a supervisor software interrupt
        # after this handler returns.
        li a1, 2
        csrw sip, a1

        ld a3, 16(a0)
        ld a2, 8(a0)
        ld a1, 0(a0)
        csrrw a0, mscratch, a0

        mret
```

Finally, after all the preparatory work is complete, we can officially enter kernel mode to perform various initialization configurations and run.
