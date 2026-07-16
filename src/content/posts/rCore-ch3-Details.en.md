---
slug: rCore-ch3-Details.en
title: rCore ch3 Details
published: 2025-04-09
tags:
  - os
  - riscv
  - rCore
category: rCore
lang: "en"
---
> This article is meant to help beginners understand the design principles of rCore more quickly, and does not cover anything related to the opencamp implementation. Some details reference the [rCore Tutorial Book chapter3](https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter3/index.html#) and the [rCore Tutorial Guild chapter3](https://learningos.cn/rCore-Tutorial-Guide-2025S/chapter3/index.html).  
> If you have any questions, please open an `issue` in the corresponding repository ([nya blog repo](https://github.com/ChenMiaoi/ChenMiaoi.github.io/tree/hexo)) using the format: [Book Name]: Question

- Reference
  - [RISC-V ISA MANUAL UNPRIVILEGE](https://github.com/riscv/riscv-isa-manual/releases/download/riscv-isa-release-8696121-2025-04-04/riscv-unprivileged.pdf)
  - [RISC-V ISA MANUAL PRIVILEGE](https://github.com/riscv/riscv-isa-manual/releases/download/riscv-isa-release-8696121-2025-04-04/riscv-privileged.pdf)

--- 

Below, I will analyze the implementation details of rCore one by one from the perspective of actually reading the code; of course, some simple mechanisms will be skipped.

Before diving into the implementation details of the rCore operating system, we first need to make sure the development environment is set up correctly. Run the following commands to switch to the ch3 branch and verify that it works:

```bash
git checkout ch3
cd os; make run
```

When faced with a complex operating system implementation, a sensible order of analysis can significantly improve the efficiency of understanding. For the rCore project, I recommend the following analysis path:

1. Build system analysis ([os/Makefile]())
2. User program analysis ([user/src/lib.rs]())
3. Kernel entry analysis ([os/src/main.rs]())

The build system is the key entry point for understanding the entire project. We focus on the execution flow of `make run` in `os/Makefile`:

```makefile
build: $(KERNEL_BIN)

$(KERNEL_BIN): kernel
	@$(OBJCOPY) $(KERNEL_ELF) --strip-all -O binary $@

kernel:
	@make -C ../user build TEST=$(TEST) CHAPTER=$(CHAPTER) BASE=$(BASE)
	@echo Platform: $(BOARD)
	@cargo build $(MODE_ARG)

run: run-inner

run-inner: build
	@qemu-system-riscv64 \
		-machine virt \
		-nographic \
		-bios $(BOOTLOADER) \
		-device loader,file=$(KERNEL_BIN),addr=$(KERNEL_ENTRY_PA)
```

In `os/Makefile`, `make run` depends on `build`, and `build` depends on `kernel`. The `kernel` target does two things:

1. Build the user applications required by `os`, which are used to validate our multiprogramming operating system
2. Build the `os` executable — in other words, the kernel image — used to boot our kernel

Therefore, we now turn our attention to `user`.

## User

After entering the `user` directory, we again need to focus on `user/Makefile` first. Here we mainly care about two points:

1. How the `binary` files needed by the kernel are produced
2. What the memory layout of the `binary` files looks like

Both of these points are covered together below:

```makefile
binary:
	@echo $(ELFS)
	@if [ ${CHAPTER} -gt 3 ]; then \
		cargo build $(MODE_ARG) ;\
	else \
		CHAPTER=$(CHAPTER) python3 build.py ;\
	fi
	@$(foreach elf, $(ELFS), \
		$(OBJCOPY) $(elf) --strip-all -O binary $(patsubst $(TARGET_DIR)/%, $(TARGET_DIR)/%.bin, $(elf)); \
		cp $(elf) $(patsubst $(TARGET_DIR)/%, $(TARGET_DIR)/%.elf, $(elf));)
```

In `chapter3`, a `build.py` script is invoked to do the actual work:

```python
base_address = 0x80400000
step = 0x20000

for app in apps:
  os.system(
    "cargo rustc --bin %s %s -- -Clink-args=-Ttext=%x"
    % (app, mode_arg, base_address + step * app_id)
  )
  if chapter == '3':
    app_id = app_id + 1
```

In this build script, the key point is that app_id increments as each application is generated, ensuring that the starting address (the .text.entry section) of every compiled user program is different. This mechanism stands in sharp contrast to the implementation in chapter2, which loads programs at a fixed address; the current approach allocates entry addresses by dynamically computing base_address + step * app_id, ensuring that different applications execute at mutually isolated locations in memory.

Next, we need to look at the user/src/lib.rs file, which defines the entry logic of user programs. This file contains two key parts:

1. The _start function: serves as the initial entry point of a user program. It is explicitly placed into the .text.entry section by the linker script, and is responsible for initializing the environment and calling the main function.
2. The weak-symbol main function (`#[linkage = "weak"]`): the weak symbol mechanism allows different user programs to provide their own main implementations, and the linker resolves to the correct version at load time. This design achieves unified management of the entry point while supporting flexible logic in different applications.

```rust
#[no_mangle]
#[link_section = ".text.entry"]
pub extern "C" fn _start(argc: usize, argv: usize) -> ! {
    clear_bss();
    unsafe {
        HEAP.lock()
            .init(HEAP_SPACE.as_ptr() as usize, USER_HEAP_SIZE);
    }
    let mut v: Vec<&'static str> = Vec::new();
    for i in 0..argc {
        let str_start =
            unsafe { ((argv + i * core::mem::size_of::<usize>()) as *const usize).read_volatile() };
        let len = (0usize..)
            .find(|i| unsafe { ((str_start + *i) as *const u8).read_volatile() == 0 })
            .unwrap();
        v.push(
            core::str::from_utf8(unsafe {
                core::slice::from_raw_parts(str_start as *const u8, len)
            })
            .unwrap(),
        );
    }
    exit(main(argc, v.as_slice()));
}

#[linkage = "weak"]
#[no_mangle]
fn main(_argc: usize, _argv: &[&str]) -> i32 {
    panic!("Cannot find main!");
}
```

During the build of a user program, the `_start` function is explicitly placed into the `.text.entry` section defined in the `src/linker.ld` linker script, and this section serves as the entry point of the user program. Through the configuration of the `build.py` compile script, the starting address of the `.text.entry` section is dynamically computed as `base_address + step * app_id`, where `base_address` is the base address, `step` is the address interval, and `app_id` is the application identifier. This address allocation mechanism ensures that once different user programs are loaded into the kernel, their entry points lie in separate, non-overlapping memory regions, thereby avoiding execution address conflicts.

In the program execution flow, `_start` further calls `exit(main(argc, v.as_slice()))`. The main function referenced here is declared as a weak symbol (`weak symbol`), a design that allows multiple `main` function definitions to exist at link time. The linker ultimately selects the `main` implementation corresponding to the user program actually loaded, thereby implementing a polymorphic entry mechanism. This architecture keeps the entry point unified while allowing different user programs to have their own independent business-logic entries.

At this point, all preparation work for user-mode programs is complete. The core mechanisms can be summarized as follows:  

- Dynamic base address allocation
- Binary files stripped of ELF information
  - The compiled user programs are processed into pure binary files (binary), with ELF-format metadata (such as section header tables, symbol tables, etc.) removed, keeping only executable code and data.  
  - The kernel can load these lightweight binary files directly without parsing complex ELF structures, which improves runtime efficiency.  
- Standardized entry point and weak symbol mechanism

## Kernel

In the build process of the rCore operating system, compiling user programs and generating the kernel image follow a strict automated build strategy. Once the user programs finish compiling, os/Makefile immediately triggers the cargo build command to produce the final kernel image.

To ensure that user programs can be correctly embedded into the kernel and that an executable environment can be set up, rCore performs key configuration steps before compilation through the build script (os/build.rs):

```rust
let mut f = File::create("src/link_app.S").unwrap();
...
```

During the build of the rCore operating system, the os/build.rs script dynamically generates the os/src/link_app.S assembly file at compile time. Its structure looks like this:

```asm
    .align 3
    .section .data
    .global _num_app
_num_app:
    .quad 2
    .quad app_0_start
    .quad app_1_start
    .quad app_1_end

    .section .data
    .global app_0_start
    .global app_0_end
app_0_start:
    .incbin "../user/build/bin/xxx.bin"
app_0_end:

    .section .data
    .global app_1_start
    .global app_1_end
app_1_start:
    .incbin "../user/build/bin/yyy.bin"
app_1_end:
```

With the user programs statically embedded and the kernel image built, the system is ready to boot. However, before actually running the kernel, we need to understand in depth the design and cooperation of the following key modules.

### Load & Task

In the design and implementation of an operating system, every task (Task), program (Program), or process (Process) needs a core data structure to maintain its execution state and context information. Taking the Process Control Block (PCB) from traditional operating system theory as a reference, the rCore operating system adopts an abstract structure called the Task Control Block (TCB), which centrally manages an application's metadata, resource descriptors, execution context, and scheduling-related attributes, thereby providing full lifecycle control over tasks:

```rust
pub enum TaskStatus {
    /// uninitialized
    UnInit,
    /// ready to run
    Ready,
    /// running
    Running,
    /// exited
    Exited,
}

pub struct TaskControlBlock {
    /// The task status in it's lifecycle
    pub task_status: TaskStatus,
    /// The task context
    pub task_cx: TaskContext,
}
```

In the multitasking management mechanism of an operating system, a single Task Control Block (TCB) can only maintain the execution view of one task. To globally manage the scheduling and state of all tasks, rCore introduces the TaskManager as a top-level abstraction, responsible for maintaining the collection of all TCBs in the system.

However, in a concurrent multitasking environment, accessing TCBs directly may lead to data races or inconsistent state. To address this, rCore adopts an inner-encapsulation design pattern (TaskManagerInner), wrapping the core task management logic (such as task scheduling, state transitions, resource allocation, etc.) in a protected inner structure, and ensures thread safety through synchronization primitives (such as mutexes or atomic operations).

```rust
pub struct TaskManager {
    /// total number of tasks
    num_app: usize,
    /// use inner value to get mutable access
    inner: UPSafeCell<TaskManagerInner>,
}

/// Inner of Task Manager
pub struct TaskManagerInner {
    /// task list
    tasks: [TaskControlBlock; MAX_APP_NUM],
    /// id of current `Running` task
    current_task: usize,
}
```

Before going further, we also need to understand the task context. In the task scheduling mechanism of an operating system, the Task Context is the core abstraction for achieving multitask concurrency; it is essentially a snapshot of a task's execution state, used to save and restore key register states during task switches.

```asm
pub struct TaskContext {
    /// Ret position after task switching
    ra: usize,
    /// Stack pointer
    sp: usize,
    /// s0-11 register, callee saved
    s: [usize; 12],
}
```

- `ra(return address)`: stores the address of the instruction to jump to after the task switch (such as __restore or the user program entry). During a context switch, the CPU returns via the ret instruction to the address pointed to by ra, achieving a seamless continuation of the execution flow.
- `sp(stack pointer)`: maintains the task's independent stack space. Each task must have its own dedicated kernel stack (or user stack); sp ensures that local variables and the function call chain can be accessed correctly after the switch.
- `sn(callee-saved register)`: the RISC-V specification requires these registers to be saved by the callee. They must be saved manually during a task switch to avoid corrupting the task's own computational state (such as loop variables, pointers, etc.).

Now we can continue analyzing the kernel's execution: during the initial boot phase of the rCore operating system, the system lazily initializes the TASK_MANAGER global variable via the lazy_static macro. For each user task, the kernel calls goto_restore(init_app_cx(i)) to initialize its context: init_app_cx(i) builds the initial execution context of the specified task on the kernel stack, and its return value serves as that task's kernel stack pointer; goto_restore sets the task's return address to the address of the __restore symbol, thereby establishing the correct execution-flow switch path from kernel mode to user mode.

After task management initialization completes, the system loads all user programs into physical memory via the load_apps function. The load addresses of these user programs strictly follow the entry address configuration preset in the build.py build script, ensuring that the binary images of user-mode programs are mapped precisely into the expected memory regions and establishing the correct address space layout for subsequent task execution.

At this point, we also need a function capable of switching task contexts, so `switch.S` is used to implement it:

1. Save the current task's `sp`
2. Save the current task's `ra`
3. Save the current task's `sn`
4. Load the next task's `ra`
5. Load the next task's `sn`
6. Load the next task's `sp`
7. Finally, return via the `ret` instruction to the address pointed to by `ra` (i.e., `__restore`) and continue execution there

It is worth noting that `__switch` **only handles saving and restoring the kernel stack and registers; it does not involve user-mode restoration or privilege level switching, so execution must transfer into `__restore` to continue**.

Therefore, we continue analyzing what happens in the full flow of `run_first_task`. `run_first_task` takes out the first task and switches with an empty task:

```rust
__switch(&mut _unused as *mut TaskContext, next_task_cx_ptr);
```

At this point, `__switch` loads the first task's stack and pointers, loads `ra(__restore)`, and enters the `__restore` entry via `ret`. One thing that was not explained in the Load phase is:

**Every task needs to load the following data when its context is initialized**:

- **Register values**
- **The sstatus register (set to User mode)**
- **The sepc register (set to the user program's entry point)**
- **The sp register (user stack pointer, x[2])**

By consulting the [RISC-V ISA PREVILEGE Supervisor-Level ISA]() we can learn that:

- The **sstatus** register is used to restore the CPU privilege state (for example, re-enabling interrupts, switching back to user mode)
- The **sepc** register is used to set the return address of the `sret` instruction (i.e., which instruction in the user program to return to).
- The **sscratch** register is used to save the user stack pointer for the subsequent stack pointer swap.

Moreover, **in the `init_app_cx` function we push the context address of each task onto the kernel stack**:

```rust
KERNEL_STACK[app_id].push_context(TrapContext::app_init_context(
    get_base_i(app_id),
    USER_STACK[app_id].get_sp(),
))
```

Therefore, we now have a clear picture of the user stack and the kernel stack:

```bash
TaskContext
    |--> ra -> __restore
    |--> sp -> kstack --> TrapContext
    ---> sn                   |--> xn
                              |--> sstatus-> User Mode
                              |--> sepc   -> User Task Base Entry
                              |              (APP_BASE_ADDRESS + app_id * APP_SIZE_LIMIT)
                              ---> sp(x2) -> user stack
```

![__switch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250409203607718.png)

Now let's return to the flow of `run_first_task`. When execution reaches `__restore`, we directly load the first task's `sstatus`, `sepc`, and `sp` pointers:

```asm
ld t0, 32*8(sp)
ld t1, 33*8(sp)
ld t2, 2*8(sp)
csrw sstatus, t0
csrw sepc, t1
csrw sscratch, t2
```

At this point, the operating system already knows the user program entry that `sret` will return to, as well as the user program's stack. It then loads the remaining registers back (**note: at this moment `sp` still points to the kernel stack**). After loading them successfully, **we need to move the kernel stack pointer by $34*8$ bytes** (`sizeof TrapContex`), and then swap the kernel stack and user stack via `csrrw` (at which point `sscratch -> kstack, sp -> user stack`).

Finally, we enter the entry point of the first user program via `sret`, and execution can begin.

At the system implementation level, some developers may have doubts about the task scheduling mechanism: **why does merely calling the `run_first_task` function complete the execution flow of all applications? Although one might intuitively think of the role of the `trap` interrupt mechanism, confusion still arises when analyzing cases like `hello_world`, which has no explicit exception trigger**. It should be noted in particular that the current kernel adopts a streamlined design in which task scheduling necessarily relies on the `trap` exception handling mechanism — specifically, the kernel implicitly performs task context saving and switching inside the exception handling routine, thereby achieving round-robin scheduling of multiple tasks. This design allows user-mode programs to be transparently managed by the system without actively triggering exceptions, embodying the typical characteristics of interrupt-driven scheduling.

### Trap

As for the `trap` mechanism of `rCore`, I personally think [rCore trap](https://rcore-os.cn/rCore-Tutorial-Book-v3/chapter2/4trap-handling.html#trap) explains it in sufficient detail, so I won't dwell on it further. Here are some `debug` screenshots for reference only.

![__switch ra & sp](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250409204246034.png)

The image above shows the inspection of the `ra` and `sp` addresses in the `__switch` function.

![__restore sp](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250409204347288.png)

The image above shows the inspection of the `kstack` address in the `__restore` function.

![__restore user sp](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/20250409204458874.png)

The image above shows the inspection of the `user stack` address in the `__restore` function.

### Syscall

For an operating system, system calls are a very simple thing (if you have already figured out the principle of the `trap` mechanism): a system call is essentially a carefully designed trap. Once you understand the magic instruction `ecall`, implementing system calls is as simple as building with blocks:

```rust
pub fn syscall(id: usize, args: [usize; 3]) -> isize {
    let mut ret: isize;
    unsafe {
        core::arch::asm!(
            "ecall",
            inlateout("x10") args[0] => ret,
            in("x11") args[1],
            in("x12") args[2],
            in("x17") id
        );
    }
    ret
}
```

Of course, if you are familiar with `xv6-riscv`, system calls are also a piece of cake:

```c
.globl start
start:
    la a0, init
    la a1, argv
    li a7, SYS_exec
    ecall
```

Now let's return to the question left unresolved above: **why can an application like `hello_world` automatically switch to the next application**?

We need to recall that when we compiled the application `binary`, we used `weak main`. Therefore, when execution reaches the application's `_start` entry, we can see:

```rust
#[link_section = ".text.entry"]
pub extern "C" fn _start(argc: usize, argv: usize) -> ! {
  exit(main(argc, v.as_slice()));
}

pub fn exit(exit_code: i32) -> ! {
  console::flush();
  sys_exit(exit_code);
}
```

The `main` call here is actually wrapped in an `exit` call, and this `exit` call is exactly the `sys_exit` system call. Therefore, after `hello_world` finishes executing, it enters `trap_handler` because of the system call, which switches to the next application:

```rust
pub fn exit_current_and_run_next() {
    mark_current_exited();
    run_next_task();
}

Trap::Exception(Exception::UserEnvCall) => {
    // jump to next instruction anyway
    cx.sepc += 4;
    // get system call return value
    cx.x[10] = syscall(cx.x[17], [cx.x[10], cx.x[11], cx.x[12]]) as usize;
}
Trap::Exception(Exception::StoreFault) | Trap::Exception(Exception::StorePageFault) => {
    println!("[kernel] PageFault in application, bad addr = {:#x}, bad instruction = {:#x}, kernel killed it.", stval, cx.sepc);
    exit_current_and_run_next();
}
Trap::Exception(Exception::IllegalInstruction) => {
    println!("[kernel] IllegalInstruction in application, kernel killed it.");
    exit_current_and_run_next();
}
Trap::Interrupt(Interrupt::SupervisorTimer) => {
    set_next_trigger();
    suspend_current_and_run_next();
}
```

At this point, the analysis of the chapter 3 implementation flow of `rCore` is complete.
