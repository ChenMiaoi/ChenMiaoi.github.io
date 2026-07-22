---
slug: ArkTS-analyze-riscv64-assember.en
title: 'ArkTS: analyze riscv64 assember'
published: 2024-07-16
tags:
  - arkts
  - ospp
category: arkts
series: arkts
lang: "en"
---
In this section, we will mainly analyze the assembly of the `RISC-V` architecture in `ArkTS`, which is also one of our main goals. The version currently being analyzed is located at [ArkTS Runtime](https://gitee.com/riscv-sig/arkcompiler_ets_runtime/tree/weekly_20230905/) [commit 2d8e197].

## RISC-V64 Detail

Before starting to analyze the actual code, we need to understand a bit of `RISC-V` knowledge. `RISC-V` is an assembly language of the `RISC` architecture, so compared with `CISC`, its assembly is more compact. In `RISC-V`, assembly is mainly divided into several corresponding types, as shown below:

![RISCV I format](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407180955152.png)

In the base `RV32I` instruction set, as shown in the figure above, there are four main instruction formats (`R`/`I`/`S`/`U`). Here, **all instructions are fixed at $32-bits$ in length, and the base instruction set has $IALIGN=32$, which means instructions in memory must be aligned to four-byte boundaries**. An instruction-address-misaligned exception is generated on a taken branch or unconditional jump if the target address is not aligned to $IALIGN$ bits. This exception is reported on the branch or jump instruction, not on the target instruction. No instruction-address-misaligned exception is generated for a conditional branch that is not taken.

The `RISC-V` **instruction set architecture keeps the source registers (`rs1` and `rs2`) and the destination register (`rd`) in the same position across all formats to simplify decoding. Immediates are always sign-extended — except for the `5`-bit immediates used in `CSR` instructions — and are generally packed into the leftmost available bits of the instruction; this arrangement is chosen to reduce hardware complexity. In particular, the sign bit of all immediates is always located at bit `31` of the instruction, to speed up the sign-extension circuitry**.

In addition to the four main instruction formats above, the base instruction set also provides variants of the `B` and `J` instruction formats:

![RISCV I format variant](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181004346.png)

The only difference between the `S` format and the `B` format is that the `12`-bit immediate field in the `B` **format encodes branch offsets in multiples of `2`. The usual practice is to shift all bits of the immediate encoded in the instruction left by one in hardware; here, however, the middle bits (`imm[10:1]`) and the sign bit stay in fixed positions, while the lowest bit of the `S` format (`inst[7]`) is encoded as a high bit in the `B` format**.

### RV32

In `RISC-V` assembly, analyzing a single instruction in isolation is tedious, because `RISC-V` instructions are usually analyzed as a group: the corresponding `funct code` and `opcode` are enough to determine exactly which instruction it is.

![RISCV opcode](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181014022.png)

#### RV32-Immediate

![RV32 Immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181022943.png)

The `ADDI` instruction adds the sign-extended `12`-bit immediate to register `rs1`. Arithmetic overflow is ignored, and only the lower `XLEN` bits of the result are kept. `ADDI rd, rs1, 0` is used to implement the assembly pseudo-instruction `MV rd, rs1`.

The `SLTI` instruction writes the value `1` into register `rd` if register `rs1` is less than the sign-extended immediate (both treated as signed numbers), otherwise it writes `0` into `rd`. `SLTIU` is similar to `SLTI`, but compares the values as unsigned numbers (i.e., the immediate is first sign-extended to $XLEN$ bits and then treated as unsigned). Note that `SLTIU rd, rs1, 1` sets `rd` to `1` if $rs1 = 0$, and to `0` otherwise (assembly pseudo-instruction `SEQZ rd, rs`).

`ANDI`, `ORI`, and `XORI` are logical operation instructions that perform bitwise AND, OR, and XOR on register `rs1` and the sign-extended `12`-bit immediate, placing the result into `rd`. Note that `XORI rd, rs1, -1` performs a bitwise logical inversion of register `rs1` (assembly pseudo-instruction `NOT rd, rs`).

![RV32 Immediate shift](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181040556.png)

Shift-by-constant instructions are encoded as a specialization of the `I`-type format. The operand to be shifted is in `rs1`, and the shift amount is encoded in the lower `5` bits of the `I`-type immediate field. The type of right shift is encoded in bit `30`. `SLLI` is a logical left shift (zeros are shifted into the low bits); `SRLI` is a logical right shift (zeros are shifted into the high bits); `SRAI` is an arithmetic right shift (the original sign bit is copied into the vacated high bits).

![RV32 Immediate other](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181048420.png)

`LUI` is used to build `32`-bit constants and uses the `U`-type format. `LUI` places the `32`-bit `U`-type immediate value into the destination register `rd`, filling the lowest `12` bits with zeros.

`AUIPC` is used to build addresses relative to the program counter (`pc`) and uses the `U`-type format. `AUIPC` forms a `32`-bit offset with the lowest `12` bits filled with zeros, adds this offset to the address of the `AUIPC` instruction itself, and then places the result into register `rd`.

#### RV32-Register

`RV32I` defines several arithmetic `R`-type operations. All operations read the `rs1` and `rs2` registers as source operands and write the result into the `rd` register. The `funct7` and `funct3` fields select the type of operation.

![RV32 Register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181115880.png)

`ADD` performs the addition of `rs1` and `rs2`. `SUB` performs the subtraction of `rs2` from `rs1`. Overflows are ignored, and the lower $XLEN$ bits of the result are written to the destination register `rd`. `SLT` and `SLTU` perform signed and unsigned comparisons respectively, writing `1` into `rd` if $rs1 lt rs2$, and `0` otherwise. Note that `SLTU rd, x0, rs2` sets `rd` to `1` if $rs \ne 0$, and to `0` otherwise (assembly pseudo-instruction `SNEZ rd, rs`). `AND`, `OR`, and `XOR` perform bitwise logical operations.

`SLL`, `SRL`, and `SRA` perform logical left shift, logical right shift, and arithmetic right shift respectively on the value in register `rs1`, by the shift amount held in the lower `5` bits of register `rs2`.

#### RV32-NOP

![RV32 NOP](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181422238.png)

The `NOP` instruction does not change any architecturally visible state, except for advancing the program counter (pc) and incrementing any applicable performance counters. `NOP` is encoded as `ADDI x0, x0, 0`.

#### RV32-Jump

`RV32I` provides two types of control transfer instructions: **unconditional jumps and conditional branches**. The control transfer instructions in `RV32I` **have no architecturally visible delay slots**. If an instruction access fault or an instruction page fault exception occurs on the target of a jump or a taken branch, the exception is reported on the target instruction, not on the jump or branch instruction.

The jump and link (`JAL`) instruction uses the `J`-type format, in which the `J`-type immediate encodes a signed offset in units of `2` bytes. The offset is sign-extended and added to the address of the jump instruction to form the jump target address. Jumps can therefore target a range of $±1 MiB$. `JAL` stores the address of the instruction following the jump, $pc+4$, into register `rd`. The standard software calling convention uses `x1` as the return address register and `x5` as an alternate link register.

A plain unconditional jump (assembly pseudo-instruction `J`) is encoded as a `JAL` with $rd=x0$.

![JAL](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181447591.png)

The indirect jump instruction `JALR` (jump and link register) uses the `I`-type encoding. The target address is obtained by adding the sign-extended `12`-bit `I`-type immediate to register `rs1`, and then setting the least significant bit of the result to zero. The address of the instruction following the jump ($pc+4$) is written into register `rd`. Register `x0` can be used as the destination register if the result is not needed.

![JALR](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181455224.png)

**If the target address is not aligned to a four-byte boundary, the `JAL` and `JALR` instructions generate an instruction-address-misaligned exception**.

**Return-address prediction stacks are a common feature of high-performance instruction fetch units, but they require accurate detection of the instructions used for procedure calls and returns to be effective**. For `RISC-V`, hints about instruction usage are implicitly encoded in the register numbers used. A return address should only be pushed onto the return-address stack (`RAS`) when the `rd` of a `JAL` instruction is `x1` or `x5`. `JALR` instructions should push/pop the `RAS` as shown in the table below.

![Return-address stack Table](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181500273.png)

#### RV32-Branch

All branch instructions use the `B`-type instruction format. The `12`-bit `B`-type immediate encodes a signed offset in units of `2` bytes. The offset is sign-extended and added to the address of the branch instruction to give the target address. The conditional branch range is $±4 KiB$.

![Branch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181502814.png)

Branch instructions compare two registers. `BEQ` and `BNE` take the branch when registers `rs1` and `rs2` are equal or unequal, respectively. `BLT` and `BLTU` take the branch when $rs1 \lt rs2$, using signed and unsigned comparisons respectively. `BGE` and `BGEU` take the branch when $rs1 \ge rs2$, using signed and unsigned comparisons respectively. Note that `BGT`, `BGTU`, `BLE`, and `BLEU` can be synthesized by reversing the operands of `BLT`, `BLTU`, `BGE`, and `BGEU`.

#### RV32-LoadStore

`RV32I` is a `load-store` architecture, in which only load and store instructions access memory, and arithmetic instructions operate only on `CPU` registers. `RV32I` provides a `32`-bit address space that is byte-addressed. The `EEI` (Execution Environment Interface) defines which parts of the address space can be accessed with which instructions (for example, some addresses may be read-only, or may only support word access). Even a load whose destination register is `x0` must still raise any exceptions and cause other side effects, even though the loaded value is discarded.

The `EEI` defines whether the memory system is little-endian or big-endian. In `RISC-V`, endianness is byte-address invariant.

![RV32I load-store](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181512721.png)

Load and store instructions transfer values between registers and memory. Load instructions are encoded in the `I`-type format, and store instructions use the `S`-type format. The effective address is obtained by adding register `rs1` to the sign-extended `12`-bit offset. Load instructions copy a value from memory into register `rd`. Store instructions copy the value in register `rs2` into memory.

The `LW` instruction loads a `32`-bit value from memory into `rd`. `LH` loads a `16`-bit value from memory, then sign-extends it to `32` bits before storing it in `rd`. `LHU` loads a `16`-bit value from memory, but zero-extends it to `32` bits before storing it in `rd`. `LB` and `LBU` are similarly defined for loading `8`-bit values. The `SW`, `SH`, and `SB` instructions store `32`-bit, `16`-bit, and `8`-bit values from the low bits of register `rs2` into memory.

#### RV32-Memory

![FENCE](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181539309.png)

The `FENCE` instruction is used to order device `I/O` and memory accesses as viewed by other `RISC-V` harts and external devices or coprocessors. Any combination of device input (`I`), device output (`O`), memory read (`R`), and memory write (`W`) may be ordered with respect to any combination of the same. **Informally, no operation in the successor set following a `FENCE` can be observed by any other `RISC-V` hart or external device before any operation in the predecessor set preceding the `FENCE` completes**.

The `FENCE` **instruction also orders memory read and write operations made by the hart relative to memory read and write operations made by an external device. However, `FENCE` does not order observations of events made by external devices using any other signaling mechanism**.

The `EEI` **defines which `I/O` operations are possible, in particular which memory addresses are treated as device input and device output operations rather than memory read and write operations when accessed by load and store instructions**. For example, memory-mapped `I/O` devices are typically accessed with uncached loads and stores, and these operations are ordered using the `I` and `O` bits rather than the `R` and `W` bits. Instruction set extensions may also describe new `I/O` instructions, which will likewise be ordered using the `I` and `O` bits in `FENCE`.

![Fence mode encoding](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181540312.png)

The `fence` mode field `fm` defines the semantics of the `FENCE` instruction. A `FENCE` instruction with $fm=0000$ orders all memory operations in its predecessor set before all memory operations in its successor set.

The `FENCE.TSO` instruction is encoded as a `FENCE` instruction with $fm=1000$, predecessor set = `RW`, and successor set = `RW`. The `FENCE.TSO` instruction orders all load operations in its predecessor set before all memory operations in its successor set, and all store operations in its predecessor set before all store operations in its successor set. This leaves non-`AMO` store operations in the predecessor set of `FENCE.TSO` unordered with respect to non-`AMO` load operations in its successor set.

#### RV32-Env

`SYSTEM` instructions are used to access system functionality that may require privileged access, and are encoded using the `I`-type instruction format. These instructions can be divided into two broad classes: instructions that **atomically read-modify-write control** and **status registers** (**CSR**s), and all other potentially privileged instructions. The `CSR` instructions need to be described separately; the basic unprivileged instructions are described in the following sections.

![SYSTEM](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181553919.png)

The `ECALL` instruction is used to make a service request to the execution environment. The `EEI` defines how the parameters of the service request are passed, but typically these parameters are placed at specified locations in the integer register file.

The `EBREAK` instruction is used to return control to the debugging environment.

### RV64

`RV64I` extends the integer registers and the supported user address space to `64` bits ($XLEN=64$).

#### RV64-Immediate

Most integer computational instructions operate on $XLEN$-bit values. `RV64I` provides additional instruction variants for operating on `32`-bit values, indicated by an opcode with a `W` suffix. These `*W` instructions ignore the upper `32` bits of their inputs and always produce `32`-bit signed values, sign-extending them to `64` bits — that is, bits $XLEN-1$ through `31` are equal.

![ADDIW](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181620677.png)

`ADDIW` is an `RV64I` instruction that adds the sign-extended `12`-bit immediate to register `rs1` and produces a properly sign-extended `32`-bit result in `rd`. Overflow is ignored, and the result is the lower `32` bits sign-extended to `64` bits. Note that `ADDIW rd, rs1, 0` writes the sign-extension of the lower `32` bits of register `rs1` into register `rd` (assembly pseudo-instruction `SEXT.W`).

![immediate](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181631534.png)

Shift-by-constant instructions use the same instruction opcodes as `RV32I`, as a specialization of the `I`-type format. The operand to be shifted is in `rs1`, and the shift amount is encoded in the lower `6` bits of the `I`-type immediate field for `RV64I`. The right-shift type is encoded in bit `30`. `SLLI` is a logical left shift (zeros are shifted into the low bits); `SRLI` is a logical right shift (zeros are shifted into the high bits); `SRAI` is an arithmetic right shift (the original sign bit is copied into the vacated high bits).

![Shift](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181633545.png)

`SLLIW`, `SRLIW`, and `SRAIW` are instructions supported only by `RV64I`; they are defined in a similar manner, but operate on `32`-bit values and sign-extend their `32`-bit results to `64` bits. Encodings of `SLLIW`, `SRLIW`, and `SRAIW` with $imm[5] \ne 0$ are reserved.

![other](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181657447.png)

`LUI` uses the same opcode as in `RV32I`. `LUI` places the `32`-bit `U`-type immediate into register `rd`, filling the lowest `12` bits with zeros. The `32`-bit result is sign-extended to `64` bits.

`AUIPC` uses the same opcode as in `RV32I`. `AUIPC` is used to build addresses relative to `pc` and uses the `U`-type format. `AUIPC` forms a `32`-bit offset from the `U`-type immediate, fills the lowest `12` bits with zeros, sign-extends the result to `64` bits, adds it to the address of the `AUIPC` instruction, and then places the result into register `rd`.

#### RV64-Register

![RV64 Register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181700821.png)

`ADDW` and `SUBW` are instructions supported only by `RV64I`; they are defined similarly to `ADD` and `SUB`, but operate on `32`-bit values and produce signed `32`-bit results. Overflow is ignored, and the lower `32` bits of the result are sign-extended to `64` bits and written to the destination register.

`SLL`, `SRL`, and `SRA` perform logical left shift, logical right shift, and arithmetic right shift on the value in register `rs1`, with the shift amount determined by the value in register `rs2`. In `RV64I`, only the lower `6` bits of `rs2` are considered as the shift amount.

`SLLW`, `SRLW`, and `SRAW` are instructions supported only by `RV64I`; they are defined similarly, but operate on `32`-bit values and sign-extend their `32`-bit results to `64` bits. The shift amount is given by `rs2[4:0]`.

#### RV64-LoadStore

`RV64I` extends the address space to `64` bits. The execution environment defines which parts of the address space are legal to access.

![Load Store](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181704209.png)

In `RV64I`, the `LD` instruction loads a `64`-bit value from memory into register `rd`.

In `RV64I`, the `LW` instruction loads a `32`-bit value from memory and sign-extends it to `64` bits before storing it in register `rd`. The `LWU` instruction, on the other hand, zero-extends the `32`-bit value from memory to `64` bits. Similarly, `LH` and `LHU` operate on `16`-bit values in the same way, and `LB` and `LBU` do likewise for `8`-bit values. The `SD`, `SW`, `SH`, and `SB` instructions store `64`-bit, `32`-bit, `16`-bit, and `8`-bit values from the low bits of register `rs2` into memory, respectively.

### RV Instructions

![RV32 Instructions](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181712540.png)

![RV64 Instructions](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202407181714021.png)

## RISC-V64 Code Detail

For the `RISC-V64` support in `ArkTS`, our first step is still to determine its corresponding registers (the code is too long, so it is not pasted here). We use `enum RegisterId : uint8_t` to define each register.

To simplify operations, we also need to define the `Opcode` and `funct` values, so that an instruction can be identified unambiguously:

```cpp
enum opCode {
    opCodeI = 0x13,       // SLLI,SRLI,SRAI,ADDI,SLTI,SLTIU,XORI,ORI,ANDI,SLLI,SRLI,SRAI,
    opCodeILoad = 0x03,   // LWU,LD,LB,LH,LW,LBU,LHU
    opCodeR = 0x33,       // ADD,SUB,SLL,SLT,SLTU,XOR,SRL,SRA,OR,AND
    opCodeW = 0x1b,       // ADDW,SUBW,SLLW,SRLW,SRAW
    opCodeS = 0x23,       // SD,SB,SH,SW
    opCodeB = 0x63,       // BEQ,BNE,BLT,BGE,BLTU,BGEU
    opCodeULui = 0x37,    // LUI
    opCodeUAuipc = 0x17,  // AUIPC
    opCodeJal = 0x6f,     // JAL
    opCodeJalr = 0x67,    // JALR
    opCodeIF = 0X0f,      // FENCE,FENCE.I
    opCodeIE = 0x73,      // ECALL,EBREA,
    opCodeIC = 0x73,      // CSRRW,CSRRS,CSRRC,CSRRWI,CSRRSI,CSRRCI,ADDIW,SLLIW,SRLIW,SRAIW
    opCodeIA = 0x3b       // ADDW,SUBW,SLLW,SRLW,SRAW
};

enum funct3 {
    funct3Slli = 0x1000,
    funct3Srli = 0x5000,
    funct3Srai = 0x5000,
    funct3Add = 0x0,
    funct3Sub = 0x0,
    funct3Sll = 0x1000,
    ...
};
```

In `ArkTS`, we still need to consider both the $32bits$ and $64bits$ cases, so we need to define a structure for declaring them:

```cpp
enum RegisterType {
    W = 0,  /* a word for 32 bits */
    D = 1,  /* a double-word for 64 bits */
};
```

Meanwhile, consistent with `Aarch64`, when processing assembly we need to operate on the fields of the assembly instructions, so we need to split the fields of each instruction. The usual approach is adopted here — splitting them with macros:

```cpp
#define DECL_FIELDS_IN_INSTRUCTION(INSTNAME, FIELD_NAME, HIGHBITS, LOWBITS) \
static const uint32_t INSTNAME##_##FIELD_NAME##_HIGHBITS = HIGHBITS;  \
static const uint32_t INSTNAME##_##FIELD_NAME##_LOWBITS = LOWBITS;    \
static const uint32_t INSTNAME##_##FIELD_NAME##_WIDTH = ((HIGHBITS - LOWBITS) + 1); \
static const uint32_t INSTNAME##_##FIELD_NAME##_MASK = (((1 << INSTNAME##_##FIELD_NAME##_WIDTH) - 1) << LOWBITS);

#define DECL_INSTRUCTION_FIELDS(V)  \
    R_TYPE_FIELD_LIST(V) \
    B_TYPE_FIELD_LIST(V) \
    S_TYPE_FIELD_LIST(V) \
    U_TYPE_FIELD_LIST(V) \
    J_TYPE_FIELD_LIST(V) \
    I_TYPE_FIELD_LIST(V)

DECL_INSTRUCTION_FIELDS(DECL_FIELDS_IN_INSTRUCTION)
#undef DECL_INSTRUCTION_FIELDS
```

### RISC-V64 Header

In `assembler_riscv64.h`, the first things to note are $XLEN$ and the handling of various field types. For the handling of field types, we can refer to the implementation process of `aarch64`, so we likewise divide them into `Register`, `Immediate`, `LogicalImmediate`, `Operand`, `Extend`, and `Shifte`.

The first thing to analyze is $XLEN$: for `RV32`, it corresponds to $XLEN = 32$; and for `RV64`, it is $XLEN = 64$:

```cpp
enum RegisterWidth {
    XLEN_32 = 32,  // 32bits
    XLEN_64 = 64   // 64
};
```

As for the `Register` type, we again provide a wrapper around `RegisterId`:

```cpp
class Register {
public:
    //TODO NOT SURE
    Register(RegisterId reg, RegisterWidth width) : reg_(reg), width_(width) {}
    Register(RegisterId reg) : reg_(reg) {};

    RegisterWidth getWidth() const;
    inline RegisterId GetId() const;
    
    inline bool IsValid() const;
    inline bool operator !=(const Register &other);
    inline bool operator ==(const Register &other);

private:
    RegisterId reg_;
    RegisterWidth width_;
};
```

One question arises here: **the official RV manual records the instruction length; `RV64` is derived from `RV32`, and the instruction length it gives is also $32bits$ — only the immediates and operand data are extended to $XLEN$ size. So could returning $64bits$ from our `getWidth` here be a problem**?

Next, we need to briefly wrap our immediates, `Immediate` and `LogicalImmediate`:

```cpp
class Immediate {
public:
    Immediate(int32_t value) : value_(value) {}
    ~Immediate() = default;

    int32_t Value() const;

private:
    int32_t value_;
};

class LogicalImmediate {
public:
    static LogicalImmediate Create(uint64_t imm, int width);
    int Value() const;

    bool IsValid() const;
    // TODO NOT SURE
private:
    explicit LogicalImmediate(int value)
        : imm_(value) {}
    static const int InvalidLogicalImmediate = -1;
    int imm_;
};
```

Then we wrap `Shift` and `Extend`:

```cpp
enum Extend : uint8_t {
    NO_EXTEND = 0xFF,
    UXTB = 0,   /* zero extend to byte */
    UXTH = 1,   /* zero extend to half word */
    UXTW = 2,   /* zero extend to word */
    UXTX = 3,   /* zero extend to 64bit */
    SXTB = 4,   /* sign extend to byte */
    SXTH = 5,   /* sign extend to half word */
    SXTW = 6,   /* sign extend to word */
    SXTX = 7,   /* sign extend to 64bit */
};

enum Shift : uint8_t {
    NO_SHIFT = 0xFF,
    LSL = 0x0,
    LSR = 0x1,
    ASR = 0x2,
    ROR = 0x3,
    MSL = 0x4,
};
```

As you can see, `Shift` and `Extend` in `RV64` also follow the `Aarch64` implementation exactly. So there is no need to elaborate further on `Operand`.

Finally, as with `Aarch`, we need to inherit from the base `Assembler` and implement the `RV64` structure:

```cpp
class AssemblerRiscv64 : public Assembler {
public:
    explicit AssemblerRiscv64(Chunk *chunk)
        : Assembler(chunk) {}
private:
    // R_TYPE field defines
    inline uint32_t Rd(uint32_t id);
    inline uint32_t Rs1(uint32_t id);
    inline uint32_t Rs2(uint32_t id);
};
```

### RV INST

**For `RV`, the instruction set is divided into roughly five types, and the structure of each type is roughly the same. Therefore, we can implement instructions of the same structure directly through macros, without implementing them manually (mainly for `RV32`)**.

Therefore, the macros `EMIT_INSTS` and `AssemblerRiscv64::INSTNAME` are provided for the implementation:

```cpp
#define EMIT_INSTS \
    EMIT_R_TYPE_INSTS(EMIT_R_TYPE_INST) \
    EMIT_B_TYPE_INSTS(EMIT_B_TYPE_INST) \
    EMIT_S_TYPE_INSTS(EMIT_S_TYPE_INST) \
    EMIT_U_TYPE_INSTS(EMIT_U_TYPE_INST) \
    EMIT_J_TYPE_INSTS(EMIT_J_TYPE_INST)
```

Here, we mainly analyze the two macros `EMIT_R_TYPE_INSTS()` and `EMIT_R_TYPE_INST`; once these two macros are understood, analyzing the other macros becomes effortless.

First, let's analyze the inner `ENIT_R_TYPE_INST` macro. This macro is the concrete interface for implementing `R`-type instructions: all `R`-type instructions can be implemented through it:

```cpp
#define EMIT_R_TYPE_INST(INSTNAME, INSTID) \
void AssemblerRiscv64::INSTNAME(const Register &rd, const Register &rs1, const Register &rs2) \
{ \
    uint32_t rd_id = Rd(rd.GetId()); \
    uint32_t rs1_id = Rs1(rs1.GetId()); \
    uint32_t rs2_id = Rs2(rs2.GetId()); \
    uint32_t code = rd_id | rs1_id | rs2_id | INSTID; \
    EmitU32(code); \
}
```

As you can see, `EMIT_R_TYPE_INST` takes two parameters: the first is the name of the instantiated function, and the second is the combination of its `opcode` and `funct`. **Because, in `RV`, the combination of `opcode` and `funct` is sufficient to determine an exact instruction**.

```cpp
enum AddSubOpFunct {
    ADD     = 0x00000033,
    ADDW    = 0x0000003b,
    ...
}

#define EMIT_R_TYPE_INSTS(V) \
    V( Add,  ADD)            \
    V(Addw, ADDW)            \
```

As you can see, `EMIT_R_TYPE_INSTS` is the entry point for implementing all `R`-type instructions. By defining the corresponding instantiation name and `OpFunct` in the `EMIT_R_TYPE_INSTS` macro, the function for handling the corresponding specific instruction can be implemented via `EMIT_R_TYPE_INST`.

At this point, the analysis of the `RV64` structure modeled on `Aarch64` is complete.

## Remaining Task Analysis

|  INST  | TYPE |  INST  | TYPE |
|:------:|:----:|:------:|:----:|
|   Jr   |  J   |  Blr   |  J   |
|   Br   |  B   |  Ret   |  J   |
| SLLIW  |  I   | SRLIW  |  I   |
| SRAIW  |  I   |  SLLI  |  I   |
|  SRLI  |  I   |  SRAI  |  I   |
| CSRRW  |  I   | CSRRS  |  I   |
| CSRRC  |  I   | CSRRWI |  I   |
| CSRRSI |  I   | CSRRCI |  I   |
| ADDIW  |  I   | FENCE  |  I   |
