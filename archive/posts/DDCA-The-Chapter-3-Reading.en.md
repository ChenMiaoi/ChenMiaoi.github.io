---
slug: DDCA-The-Chapter-3-Reading.en
title: 'DDCA: The Chapter 3 Reading'
published: 2024-04-13
tags:
  - ysyx
  - digital
  - logic
category: books
series: ddca
lang: "en"
---
In the previous note, we showed how to analyze and design combinational logic circuits. **The outputs of a combinational logic circuit depend only on the current input values of the circuit**.

## Introduction

In this note, we will analyze and design `sequential logic`. **The outputs of sequential logic depend on both the current and the previous input values, so sequential logic has memory**. Sequential logic may explicitly record the exact values of previous inputs, or it may distill the previous inputs into a smaller amount of information called the `state` of the system. **The state of a digital sequential circuit is a set of bits called** `state variables` **that contains all the information about the past necessary to explain the future behavior of the circuit**.

## Latches and Flip-Flops

**The most basic building block of memory is the** `bistable` **element, an element with two stable states**. Figure (a) below shows a simple bistable element consisting of a pair of inverters connected in a loop; Figure (b) shows the same circuit redrawn to emphasize its symmetry. **The inverters are** `cross-coupled`, **meaning that the input of $I1$ is the output of $I2$, and vice versa**. **The circuit has no inputs, but it has two outputs**, $Q$ and $\overline {Q}$.

![Cross-couple inverter pair](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131905695.png)

Analyzing this circuit differs from analyzing a combinational logic circuit because it is cyclic: $Q$ depends on $\overline {Q}$, and $\overline {Q}$ depends on $Q$.

Consider the two cases where $Q$ is `0` and `1`:

- When $Q = 0$:
  - As shown in Figure (a) below, $I2$ receives a $FALSE$ input $Q$, so it produces a $TRUE$ output $\overline {Q}$. $I1$ in turn receives a $TRUE$ input $\overline {Q}$, so it produces a $FALSE$ output $Q$. **This is consistent with the original assumption that $Q = 0$, so this case is said to be stable**
- When $Q = 1$:
  - As shown in Figure (b) below, by the same reasoning we end up with a $TRUE$ output $Q$, so this case is also stable

**Because the cross-coupled inverters have two stable states, this circuit is called bistable**. There is, however, a subtle point: **the circuit has a third possible state in which both outputs are roughly halfway between** `0` **and** `1`; **this is called the** `metastable state`, and it will be discussed later.

![Bistable operation of cross-couple](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131916972.png)

An element with $N$ stable states can convey $\log_2N \ bits$ of information, so **a bistable element stores one bit**. **The state of the cross-coupled inverters is contained in a single binary state variable, $Q$, so the value of $Q$ tells us everything about the past that is necessary to explain the future behavior of the circuit**. The circuit does have another node, $\overline {Q}$, but $\overline {Q}$ does not contain any additional information, because if $Q$ is known, then $\overline {Q}$ is known as well. On the other hand, $\overline {Q}$ is also an acceptable choice for the state variable of the bistable element.

**When power is first applied to a sequential circuit, its initial state is unknown and usually unpredictable, and the state may be different each time the circuit is turned on**.

Although the cross-coupled inverters can store one bit of information, **they are not practical because the user has no inputs to control the state**. `Latches` and `flip-flops`, however, provide inputs that control the state variable, so we now consider these two bistable elements.

### SR Latch

The simplest sequential circuit is the `SR latch`, **which is composed of two cross-coupled NOR gates**. As shown in the figure below, the latch has two inputs, $S$ and $R$, and two outputs, $Q$ and $\overline{Q}$. The $SR$ latch is similar to the cross-coupled inverters, but its state can be controlled through the $S$ and $R$ inputs, which `set` and `reset` the output $Q$.

A good way to understand an unfamiliar circuit is to write out its truth table. Recall that a NOR gate produces a $FALSE$ output whenever any of its inputs is $TRUE$:

- When $R = 1, S = 0$:
  - $N1$ first sees that at least one input, $R$, is $TRUE$, so it produces a $FALSE$ output $Q$. $N2$ sees that both $Q$ and $S$ are $FALSE$, so it produces a $TRUE$ output $\overline {Q}$
- When $R = 0, S = 1$:
  - $N1$ receives the inputs `0` and $\overline {Q}$. Because we do not yet know $\overline {Q}$, we cannot determine its output $Q$. $N2$ receives at least one $TRUE$ input, $S$, so it produces a $FALSE$ output $\overline {Q}$. Now we revisit $N1$: both of its inputs are $FALSE$, so its output $Q$ is $TRUE$
- When $R = 1, S = 1$:
  - Both $N1$ and $N2$ see at least one $TRUE$ input ($R$ or $S$), so each produces a $FALSE$ output. Therefore $Q$ and $\overline {Q}$ are both $FALSE$
- When $R = 0, S = 0$:
  - $N1$ receives the inputs `0` and $\overline {Q}$. Because we do not yet know $\overline {Q}$, we cannot determine its output. $N2$ receives the inputs `0` and $Q$; because we do not know $Q$, we cannot determine its output either. Now we are stuck, but we know that $Q$ is either `1` or `0`, so we can examine each subcase to resolve the problem:
    - When $Q = 0$:
      - Because $S$ and $Q$ are both $FALSE$, $N2$ produces a $TRUE$ output $\overline {Q}$. Now $N1$ receives a $TRUE$ input $\overline {Q}$, so it produces a $FALSE$ $Q$, just as we assumed
    - When $Q = 1$:
      - Because $Q$ is $TRUE$, $N2$ produces a $FALSE$ output $\overline{Q}$. Now $N1$ receives two $FALSE$ inputs, $R$ and $\overline {Q}$, so it produces a $TRUE$ output $Q$, just as we assumed

In summary, before entering the fourth case, $Q$ already had some known previous value, called $Q_{prev}$. $Q_{prev}$ is either `0` or `1` and represents the state of the system. When $R$ and $S$ are `0`, $Q$ remembers the old value $Q_{prev}$, and $\overline {Q}$ is its complement, $\overline {Q_{prev}}$. Thus, this circuit has memory.

![Bistable state of SR latch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404131949339.png)

The truth table in the figure below summarizes these four cases. The inputs $S$ and $R$ stand for $Set$ and $Reset$, respectively. To set a bit means to make it $TRUE$, and to reset a bit means to make it $FALSE$. When $R$ is asserted, $Q$ is reset to `0` and $\overline {Q}$ is the opposite. When $S$ is asserted, $Q$ is set to `1` and $\overline {Q}$ is the opposite. When neither input is asserted, $Q$ remembers its old value, $O_{prev}$. Asserting both $S$ and $R$ at the same time is meaningless, because it would require the latch to be set and reset simultaneously, which is impossible.

![SR latch truth table and symbol](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404132030554.png)

The $SR$ latch is represented by the symbol on the right of the figure above. Like the cross-coupled inverters, the $SR$ latch is a bistable element, and one bit of state can be stored in $Q$. **Regardless of what sets and resets occurred in the past, all that is needed to predict the future behavior of an $SR$ latch is the most recent set or reset**.

### D Latch

The $SR$ latch is awkward because it behaves strangely when both $S$ and $R$ are asserted. Moreover, **the $S$ and $R$ inputs conflate the issues of *when* and *what*. Asserting one of the two inputs determines not only what the state should be, but also when it should change**. Circuit design becomes easier when these factors are separated. The `D latch` shown in the figure below solves this problem. It has two inputs: the `data` input, $D$, controls what the next state should be, and the `clock` input, $CLK$, controls when the state should change.

Once again, we analyze the latch by writing out its truth table. For convenience, we first consider the internal nodes $\overline {D}$, $S$, and $R$.

- If $CLK= 0$, both $S$ and $R$ are $FALSE$, regardless of the value of $D$
- If $CLK = 1$, one AND gate produces $TRUE$ and the other produces $FALSE$, depending on the value of $D$.
- Given $S$ and $R$, $Q$ and $\overline {Q}$ are determined just as they were in the $SR$ latch:
  - When $CLK = 0$, $Q$ remembers its old value, $Q_{prev}$
  - When $CLK = 1$, $Q = D$

Thus, the $D$ latch avoids the strange case of simultaneously asserting $S$ and $R$. Putting everything together, we see that the clock controls when data flows through the latch. When $CLK = 1$, the latch is `transparent`: the data at $D$ flows through to $Q$ as if the latch were just a buffer. When $CLK = 0$, the latch is opaque: it blocks new data from flowing through to $Q$, and $Q$ retains its old value. For this reason, the $D$ latch is sometimes called a `transparent latch` or a `level-sensitive latch`. The symbol for the $D$ latch is shown in Figure (c).

![D latch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404132105532.png)

When $CLK = 1$, the $D$ latch updates its state continuously. Later in this chapter, we will see that it is useful to update the state only at specific points in time. The $D$ flip-flop described in the next section does exactly that.

### D Flip-Flop

A `D flip-flop` can be built from two back-to-back $D$ latches controlled by complementary clock signals $CLK$, as shown in the figure below. The first latch is called the $master$, and the second is called the $slave$. The symbol for the $D$ flip-flop is shown in Figure (b); when the output $\overline{Q}$ is not needed, the symbol in Figure (c) can be used instead.

![D Flip-flop](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404140827764.png)

When $CLK = 0$, the $master$ latch is transparent (data flows through) and the $slave$ latch is opaque (data does not flow through). Therefore, **whatever value is present at $D$ is passed to** $N1$. When $CLK = 1$, the master latch becomes opaque and the slave latch becomes transparent. The value at $N1$ then propagates to $Q$, but $N1$ is cut off from $D$. Hence, whatever value was at $D$ immediately before the clock transitions from `0` to `1` is copied to $Q$ after the clock rises. At all other times, $Q$ retains its old value, because there is always an opaque latch blocking the path between $D$ and $Q$.

**In other words, the $D$ flip-flop copies $D$ to $Q$ on the rising edge of the clock and remembers its state at all other times**. For brevity, the rising edge of the clock is often simply called the `clock edge`. **The $D$ input specifies what the new state will be, and the clock edge indicates when the state should be updated**.

The $D$ flip-flop is also known as a `master-slave flip-flop`, an `edge-triggered flip-flop`, or a `positive edge-triggered flip-flop`. The triangle in the symbol denotes an edge-triggered clock input. The $\overline{Q}$ output is often omitted when it is not needed.

### Register

**An $N-bit$ register is a bank of $N$ flip-flops that share a common $CLK$ input, so that all bits of the register are updated and saved at the same time**. Registers are the key building block of most sequential circuits. The figure below shows the schematic and symbol of a four-bit register; its input $D_{3:0}$ and output $Q_{3:0}$ are both four-bit busses.

![a 4-bit register](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404140858433.png)

### Enabled Flip-Flop

An `enabled flip-flop` adds another input, called $EN$ or $ENABLE$, **which determines whether data is loaded on the clock edge**. When $EN$ is $TRUE$, the enabled flip-flop behaves like an ordinary $D$ flip-flop. When $EN$ is $FALSE$, the enabled flip-flop ignores the clock and retains its state. **Enabled flip-flops are extremely useful when we wish to load a new value only some of the time, rather than on every clock edge**.

![Enabled Flip-Flop](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404140901786.png)

The figure above shows two ways to build an enabled flip-flop. In Figure (a), a multiplexer selects whether the input is passed to $D$; in Figure (b), the clock is gated with an AND gate, which lets the flip-flop update its state only when both inputs are $TRUE$. **Note that $EN$ must not change while $CLK = 1$, lest the flip-flop see a clock glitch**. In general, **performing logic on the clock is a bad idea: gating the clock delays it and can cause timing errors**. The symbol for the enabled flip-flop is shown in Figure (c).

### Resettable Flip-Flop

A `resettable flip-flop` adds another input, called $RESET$. When $RESET$ is $FALSE$, the resettable flip-flop behaves like an ordinary $D$ flip-flop. When $RESET$ is $TRUE$, the resettable flip-flop ignores $D$ and resets the output to `0`. **Resettable flip-flops are useful when we want to force a known state into all the flip-flops of a system when we first turn it on**.

![Resettable flip-flop](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404140918455.png)

Such flip-flops may be reset `synchronously` or `asynchronously`. A synchronously resettable flip-flop resets itself only on the rising edge of $CLK$, whereas an asynchronously resettable flip-flop resets itself as soon as $RESET$ becomes $TRUE$, regardless of $CLK$.

Figure (a) above shows how to build a synchronously resettable flip-flop from an ordinary $D$ flip-flop and an AND gate. When $\overline {RESET}$ is $FALSE$, the AND gate forces a `0` into the input of the flip-flop. When $\overline {RESET}$ is $TRUE$, the AND gate passes $D$ to the input. Thus, in Figure (a), $\overline {RESET}$ is an `active low` signal; adding an inverter, Figures (b) and (c) show the symbol for a resettable flip-flop with an `active high` reset signal.

### Putting It All Together

Latches and flip-flops are the fundamental building blocks of sequential circuits. **Remember that a $D$ latch is level-sensitive, whereas a $D$ flip-flop is edge-triggered**. The $D$ latch is transparent when $CLK = 1$, allowing the data at $D$ to flow through to the output $Q$. The $D$ flip-flop copies the data at $D$ to the output $Q$ on the rising edge of $CLK$. At all other times, latches and flip-flops retain their state. A register is a bank of several $D$ flip-flops that share a common $CLK$ signal.

![comparison waveforms](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404140943122.png)

The figure above shows the timing diagram of the latch and the flip-flop, assuming that the delay for $Q$ to respond to input changes is small. The arrows indicate what causes each change in the outputs. The initial value of $Q$ is unknown and could be either `0` or `1`, as indicated by the pair of parallel lines in the figure above.

- First consider the latch. On the first rising edge of $CLK$, $D = 0$, so $Q$ definitely becomes `0`. Each time $D$ changes while $CLK = 1$, $Q$ follows. Changes in $D$ while $CLK = 0$ are ignored.
- Now consider the flip-flop. On each rising edge of $CLK$, $D$ is copied to $Q$. At all other times, $Q$ retains its state.

## Synchronous Logic Design

In general, sequential circuits include all circuits that are not combinational — that is, **circuits whose outputs cannot be determined simply by looking at the current inputs**. This section introduces **the concept of synchronous sequential circuits and the dynamic discipline**.

### Some Problematic Circuits

> `Astable circuits`
> Now we have a loop formed by three misused inverters. As shown in the figure below, the output of the third inverter is fed back to the input of the first inverter. Each inverter has a propagation delay of $1ns$. Determine what this circuit does.

![ring oscillator waveforms](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404141051188.png)

Suppose node $X$ is initially `0`. Then $Y = 1, Z = 0$, which in turn makes $X = 1$, contradicting our original assumption. The circuit has no stable state and is therefore said to be `unstable` or `astable`. The figure above shows the behavior of the circuit.

If $X$ rises at time `0`, $Y$ falls at $1ns$, $Z$ rises at $2ns$, and $X$ falls at $3ns$. In the next round, $Y$ rises at $4ns$, $Z$ falls at $5ns$, and so on, repeating indefinitely. Each node oscillates between $0 \thicksim 1$ with a period (the repetition time) of $6ns$. This circuit is called a `ring oscillator`.

**The period of the ring oscillator depends on the propagation delay of each inverter, which in turn depends on how the inverters were manufactured, the power supply voltage, and even the temperature**. Therefore, the period of a ring oscillator is difficult to predict accurately. **In short, the ring oscillator is a sequential circuit with zero inputs and one output that changes periodically**.

> `Race conditions`
> Here we have designed a new $D$ latch that we claim is better than the latch introduced earlier because it uses fewer gates, as shown in the figure below.
> Determine whether this latch works correctly, and whether each gate has an independent delay.

![an improved? D latch](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404141101015.png)

The figure above shows a race condition that causes the circuit to fail when certain gates are slower than others. Suppose $CLK = D = 1$. The latch is transparent and passes $D$ through, making $Q = 1$. Now $CLK$ falls. The latch should remember its old value, keeping $Q = 1$. However, suppose the delay through the inverter from $CLK$ to $\overline {CLK}$ is rather long compared to the delays of the AND and OR gates. Then nodes $N1$ and $Q$ may both fall before $\overline {CLK}$ rises. In such a case, $N2$ never rises, and $Q$ becomes stuck at `0`.


This is an example of asynchronous circuit design, **in which outputs are fed directly back to inputs**. **Asynchronous circuits are infamous for race conditions: the behavior of the circuit depends on which of two paths through logic gates is fastest. One circuit may work, while another seemingly identical circuit built from gates with slightly different delays may not. Or the circuit may work only at certain temperatures or voltages at which the delays are just right. These maddening errors are extremely difficult to track down**.

### Synchronous Sequential Circuits

The previous two examples contain cyclic paths in which the output is fed directly back to the input. **If an input is applied to a combinational circuit, the output always settles to the correct value within a propagation delay. However, a sequential circuit with a cyclic path can exhibit undesirable races or unstable behavior**.

To avoid these problems, **designers break the cyclic paths by inserting registers somewhere in the path**. This transforms the circuit into a collection of combinational logic and registers. **The registers contain the state of the system, which changes only at the clock edge, so the state is** `synchronized` **to the clock**. **If the clock is sufficiently slow, so that the inputs to all of the registers settle before the next clock edge, all races are eliminated. This discipline of using registers in cyclic paths leads us to the formal definition of a synchronous sequential circuit**.

**A sequential circuit has a finite set of discrete states: $S_0, S_1, \cdots, S_{k - 1}$. A synchronous sequential circuit has a clock input whose rising edges indicate a sequence of times at which state transitions occur. We often use the terms *current state* and *next state* to distinguish the state of the system at the present from the state to which it will enter on the next clock edge. The functional specification of a sequential circuit details, for each possible combination of current state and input values, the next state and the value of each output. The timing specification of a sequential circuit consists of an upper bound $t_{pcq}$ and a lower bound $t_{ccq}$ on the time from the rising edge of the clock until the output changes, as well as the setup and hold times, $t_{setup}$ and $t_{hold}$, during which the inputs must be stable relative to the rising edge of the clock**.

**The rules of synchronous sequential circuit composition tell us that a circuit is a synchronous sequential circuit if it consists of interconnected circuit elements such that**:

- Every circuit element is either a register or a combinational circuit
- At least one circuit element is a register
- All registers receive the same clock signal
- Every cyclic path contains at least one register

Sequential circuits that are not synchronous are called asynchronous.

A flip-flop is the simplest synchronous sequential circuit. It has one input, $D$, a clock, $CLK$, one output, $Q$, and two states, ${0, 1}$. The functional specification of a flip-flop is that the next state is $D$ and that the output $Q$ is the current state. Two other common types of synchronous sequential circuits are called finite state machines and pipelines; these will be introduced later.

> Determine which of the circuits is a synchronous sequential circuit.

![example circuits](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404141507671.png)

- Figure (a) is a combinational circuit, not a sequential circuit
- Figure (b) is a simple sequential circuit without feedback, but it is not synchronous
- Figure (c) is neither a combinational circuit nor a synchronous sequential circuit, because it has a latch that is neither a combinational circuit nor a register
- Figures (d) and (e) are synchronous sequential circuits; they are also simple forms of finite state machines
- Figure (f) is neither a combinational circuit nor a synchronous sequential circuit, because it has no register on the cyclic path
- Figure (g) is a synchronous sequential circuit, and it is in the form of a pipeline
- Figure (h) is not, strictly speaking, a synchronous sequential circuit, because the second register receives a different clock signal (delayed by two inverters)

### Synchronous and Asynchronous Circuits

**Asynchronous design is, in theory, more general than synchronous design, because the timing of the system is not limited by clocked registers**, just as analog circuits are more general than digital circuits. **However, synchronous circuits have proved easier to design and use than asynchronous circuits, and despite decades of research on asynchronous circuits, virtually all digital systems are essentially synchronous in nature**.

Of course, asynchronous circuits are occasionally necessary when communicating between systems with different clocks or when receiving inputs at arbitrary times.

## Finite State Machine

Synchronous sequential circuits can be drawn in the form called a `finite state machine (FSM)`, as shown in the figure below. **The name comes from the fact that a circuit with $k$ registers can be in one of a finite number ($2^k$) of unique states**. A finite state machine has $M$ inputs, $N$ outputs, and $k$ bits of state. It also receives a clock and, optionally, a reset signal. **An FSM consists of two blocks of combinational logic — the next state logic and the output logic — and a register that stores the state. On each clock edge, the FSM advances to the next state, which is computed from the current state and the inputs**. There are two general classes of finite state machines, characterized by their functional specifications.

- $Moore Machines$
  - **The outputs depend only on the current state of the machine**
- $Mealy Machines$
  - **The outputs depend on both the current state and the current inputs of the machine**

**Given a functional specification, finite state machines provide a systematic way to design synchronous sequential circuits**.

![Finite state machines](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404141521542.png)

### FSM Design Example

To illustrate the design of finite state machines, consider the problem of inventing a controller for a traffic light at a busy intersection on campus.

We decide to solve the problem with a finite state machine. We install two traffic sensors, $T_A$ and $T_B$, one on each of the two intersecting roads. Each sensor indicates $TRUE$ when students are present and $FALSE$ when the street is empty. We also install two traffic lights, $L_A$ and $L_B$, to control traffic. Each light receives digital inputs specifying whether it displays red, yellow, or green. Hence, our FSM has two inputs, $T_A$ and $T_B$, and two outputs, $L_A$ and $L_B$. We also provide a clock with a period of $5s$ and a reset button to place the FSM in a known initial state, as shown in the figure below.

![fsm machines](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404141543278.png)

The next step is to sketch the state transition diagram shown in the figure above, which indicates all the possible states of the system and the transitions between them. When the system is reset, $L_A$ should be green and $L_B$ should be red. Every five seconds, the controller examines the traffic pattern and decides what to do next. As long as traffic is present on $Academic Ave$, the lights do not change. When there is no longer traffic on Academic Ave, the light turns yellow for five seconds before turning red, and the light on $Bravado Ave$ turns green. Similarly, while traffic is present on $Bravado$, its light remains green; when traffic is gone, it turns yellow, then red.

In a state transition diagram, circles represent states and arcs represent transitions between states. The transitions take place on the rising edge of the clock. In other words, the clock simply controls when the transitions occur, whereas the state transition diagram indicates which transitions occur. The arc labeled $Reset$, pointing from outer space into state $S_0$, indicates that the system should enter that state upon reset, regardless of its previous state. If a state has multiple arcs leaving it, each arc is labeled with the input values that trigger that transition. If a state has a single arc leaving it, that arc may be left unlabeled, indicating that the transition always occurs regardless of the inputs.

We rewrite the state transition diagram as a state transition table, which indicates, for each state and input, what the next state $S'$ should be. Note that **when the next state does not depend on a particular input, the table uses the $Don't Cares$ symbol $X$**. Also note that the extraneous $Reset$ symbol is omitted from the table.

The state transition diagram is abstract: it uses states labeled ${S_0, S_1, S_2, S_3}$ and outputs labeled ${red, yellow, green}$. To build a real circuit, **the states and outputs must be assigned binary encodings**. The figure below shows the encodings: each state and output is encoded with two bits — $S_{1:0}$, $L_{A1:0}$, and $L_{B1:0}$

![state tables](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404141600013.png)

We then update the state transition table to use these encodings, as shown in the figure below. The revised state transition table is a truth table specifying the next state logic. It defines the next state, $S'$, as a function of the current state, $S$, and the inputs.

![state transition table](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404141607142.png)

From this truth table, it is straightforward to read off the Boolean equations for the next state in sum-of-products form:

$$
  S_1' = \overline {S_1}S_0 + S_1\overline {S_0}\overline {T_B} + S_1\overline {S_0}T_B
$$

$$
  S_0' = \overline {S_1}\overline {S_0}\overline {T_A} + S_1\overline {S_0}\overline {T_B}
$$

The equations above could be simplified with Karnaugh maps, but by inspection we can see that \overline {T_B} and $T_B$ can be simplified, and that $S_1'$ reduces to an XOR operation. Hence:

$$
  S_1' = S_1 \oplus S_2
$$

$$
  S_0' = \overline {S_1}\overline {S_0}\overline {T_A} + S_1\overline {S_0}\overline {T_B}
$$

As before, we write an output truth table in the same way, indicating, for each state, what the output should be in that state, and then derive its Boolean equations.

![output table](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404141617387.png)

$$
  L_{A1} = S_1 \qquad L_{A0} = \overline {S_1}S_0
$$

$$
  L_{B1} = \overline {S_1} \qquad L_{B0} = S_1S_0
$$

Finally, we can draw the $Moore$ machine.

First, we draw the $2-bit$ state register, as shown in Figure (a) below. On each clock edge, the state register copies the next state, $S_{1:0}'$, to become the state $S_{1:0}$. The state register receives a synchronous or asynchronous reset to initialize the FSM at startup.

Next, we draw the next state logic based on the Boolean equations we derived for $S_1'$ and $S_0'$, which computes the next state from the current state and inputs, as shown in Figure (b).

Finally, we draw the output logic based on the Boolean equations we derived for the outputs, which computes the outputs from the current state, as shown in Figure (c).

![state machine circuit](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404141620067.png)

The figure below shows a timing diagram of the traffic light controller going through a sequence of states. The diagram shows $CLK$, $Reset$, the inputs $T_A$ and $T_B$, the next state $S'$, the current state $S$, and the outputs $L_A$ and $L_B$. Arrows indicate causality, and dashed lines indicate the rising edges of the clock at which the state changes.

![timing diagram for traffic](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202404141633186.png)

The clock has a period of $5s$, so the traffic lights change at most once every five seconds. When the finite state machine is first turned on, its state is unknown, so the system must be reset to a known state. In this timing diagram, $S$ is reset immediately to $S_0$, indicating that asynchronously resettable flip-flops are being used. In state $S_0$, $L_A$ is green and $L_B$ is red.

### State Encodings

In the previous example, the state and output encodings were selected arbitrarily. A different choice would have resulted in a different circuit. **A natural question is: how can we determine the encoding that produces a circuit with the fewest logic gates or the shortest propagation delay?** Unfortunately, there is no simple way to find the best encoding other than trying every possibility, which is infeasible when the number of states is large. However, it is often possible to choose a good encoding by inspection, so that related states or outputs share bits. Computer-aided design ($CDA$) tools are also good at searching the set of possible encodings and selecting a reasonable one.

One important decision in state encoding is the choice between binary encoding and one-hot encoding. (Recall that *one-hot* means that only one output is $TRUE$ at a time.)

- With binary encoding, as was used in the traffic light controller example, each state is represented as a binary number. Because $K$ binary numbers can be represented with $log_2K$ bits, a system with $K$ states only needs $log_2K$ bits of state.
- In one-hot encoding, a separate bit of state is used for each state. It is called `one-hot` because only one bit is `hot`, or $TRUE$, at any time. For example, a one-hot encoded FSM with three states would have state encodings of $001$, $010$, and $100$. Each bit of state is stored in a flip-flop, so one-hot encoding requires more flip-flops than binary encoding. However, with one-hot encoding, the next state and output logic is often simpler, so fewer gates are required.

Therefore, the best encoding must be determined on a case-by-case basis for each finite state machine.

### Moore and Mealy Machines

So far, we have shown examples of $Moore machines$, **in which the output depends only on the state of the system**. Hence, in state transition diagrams of $Moore machines$, the outputs are labeled inside the circles. $Mealy machines$ are similar to $Moore machines$, except that **the outputs depend on the current state as well as the current inputs**. Hence, in state transition diagrams of $Mealy machines$, the outputs are labeled on the arcs rather than inside the circles.
