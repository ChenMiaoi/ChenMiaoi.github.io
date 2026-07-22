---
slug: Raft-An-Understandable-Consensus-Algorithm.en
title: 'Raft: An Understandable Consensus Algorithm'
published: 2024-09-26
tags:
  - raft
  - distributed
category: raft
lang: "en"
---
Raft is an algorithm for managing a $replicated\ log$. It achieves consensus by $electing\ a\ leader$ and giving that $leader$ full authority over the $replicated\ log$. The $leader$ receives $log\ entries$ from clients, replicates them to the other servers, and tells the servers when the $log\ entries$ are safe to apply to their $state\ machines$.

> Raft simplifies the management of the $replicated\ log$ by $electing\ a\ leader$. The $leader$ can decide where to place a $new\ log\ entry$ in the log without consulting other servers, and data flows from the $leader$ to the other servers in a simple way.  
> A $leader$ can fail or become disconnected from the other servers, in which case a new $leader$ will be $elected$.

With the $leader$ approach, $Raft$ decomposes the consensus problem into three relatively independent subproblems:

- $Leader\ Election$
  - When an existing $leader$ fails, a new $leader$ must be $elected$
- $Log\ Replication$
  - The $leader$ must accept $log\ entries$ from clients and replicate them across the cluster, forcing the other logs to agree with its own
- $Safety$
  - The key $safety\ property$ of $Raft$ is the state machine safety property shown in the figure below: if any server applies a particular $log\ entry$ to its state machine, then no other server may apply a different command for the same log index.

<a name="Figure3"></a>
![Figure 3](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202409261547094.png)

### Raft Basics

A $Raft$ cluster contains several servers; five is typical, which allows the system to tolerate two failures.

> This is because Raft uses the majority-vote principle to decide the cluster's $leader$ and state updates. In a 5-server cluster, even if 2 servers fail, the remaining 3 can still form a majority (2 of 3) and keep serving. This gives the system fault tolerance: it can preserve consistency and availability even when some servers are down.

**At any given time, each server is in one of three states: $leader$, $follower$, or $candidate$**. In normal operation, **there is exactly one $leader$ and all of the other servers are $followers$. $Followers$ are passive: they issue no requests on their own but simply respond to requests from $leaders$ and $candidates$**. The $leader$ handles all client requests (if a client contacts a $follower$, the $follower$ redirects it to the $leader$). The third state, $candidate$, is used to elect a new $leader$, as described in the next section. The states and their transitions are shown below:

<a name="Figure4"></a>
![Figure 4](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202409261710112.png)

$Raft$ divides time into $Terms$ of arbitrary length, as shown below. $Terms$ are numbered with consecutive integers. **Each $Term$ begins with an $election$, in which one or more $candidates$ attempt to become the $leader$**. **If a $candidate$ wins the $election$, it serves as the $leader$ for the rest of the $Term$**.

**In some situations the $election$ results in a split vote. In that case the $Term$ ends with $no\ leader$; a new $Term$ (with a new $election$) begins shortly**. $Raft$ **ensures that there is at most one** $leader$ in a given $Term$.

> A split vote in an $election$ means multiple $candidates$ received the same number of votes.  
> $Raft$ ensures there is at most one $leader$ in each $Term$.

Different servers may observe the transitions between $Terms$ at different times, and in some situations a server may not observe an $election$ or even an entire $Term$. $Terms$ act as a $logical\ clock$ in $Raft$, allowing servers to detect obsolete information such as dead $leaders$. Each server stores a $current\ term\ number$, which increases monotonically over time.

> Here, a $logical\ clock$ refers to a mechanism for ordering events. In $Raft$, the $Term\ number$ serves as the $logical\ clock$, helping servers track system state and identify stale information. By comparing $Term\ numbers$, servers can tell which information is up to date and avoid interacting with obsolete leaders or data. This mechanism keeps the system consistent and stable even though servers may observe events in different orders.

**$Current\ term\ numbers$ are exchanged whenever servers communicate; if one server's $current\ term$ is smaller than the other's, it updates its $term\ number$ to the larger value. If a $candidate$ or $leader$ discovers that its $Term$ is out of date, it immediately reverts to the $follower\ state$. If a server receives a request with a stale $term\ number$, it rejects the request**.

$Raft$ servers communicate using $RPCs$, and the basic consensus algorithm requires only two types of $RPCs$:

- **$RequestVote\ RPCs$, initiated by $candidates$ during $elections$**  
- **$AppendEntries\ RPCs$, initiated by $leaders$ to replicate $log\ entries$ and to provide a form of $heartbeat$**.

> The $heartbeat$ mechanism is a communication pattern in distributed systems **used to maintain liveness and coordination between nodes**.

If servers do not receive a response in time, they retry the $RPCs$, and they issue $RPCs$ in parallel for best performance.

### Leader election

**$Raft$ uses a $heartbeat$ mechanism to trigger $elections$. When servers start up, they begin as $followers$. A server remains in the $follower\ state$ as long as it receives valid $RPCs$ from a $leader$ or $candidate$. $Leaders$ send periodic $heartbeats$ ($AppendEntries\ RPCs$ that carry no $log\ entries$) to all $followers$ in order to maintain their authority**. **If a $follower$ receives no communication over a period of time, it assumes there is no viable $leader$ and begins an $election$ to choose a new** $leader$.

> This gives the details of the $heartbeat$ mechanism:  
>> Maintaining the $leader\ state$: the $leader$ periodically sends $heartbeats$ ($AppendEntries\ RPCs$ with no $log\ entry$) to $followers$ to show that it is still the valid $leader$.  
>> Detecting failures: if a $follower$ does not receive $heartbeats$ from the $leader$ within a certain time, it may consider the $leader$ dead and trigger a new $election$.  
>> Updating the $Term$: $heartbeats$ carry the $current\ term\ number$, which helps $followers$ update their state so they do not interact with an obsolete $leader$.  
>> Maintaining consistency: with periodic $heartbeats$, the system can promptly detect and handle state changes between nodes, preserving consistency and availability.

To begin an $election$, a $follower$ **increments its $current\ term\ number$ and transitions to the $candidate\ state$. It then votes for itself and issues $RequestVote\ RPCs$ in parallel to each of the other servers in the cluster**. A $candidate$ remains in that state until one of the following happens:

- It wins the $election$
- Another server wins and becomes the $leader$
- A period of time goes by with no winner

**A $candidate$ $wins\ an\ election$ if it receives $votes$ from a majority of the servers in the full cluster for the same $Term$. Each server votes for at most one $candidate$ in a given $Term$, on a first-come-first-served basis**. The $majority\ rule$ ensures that at most one $candidate$ can win the $election$ in a particular $Term$. Once a $candidate$ wins an $election$, it immediately becomes the $leader$, **and it sends $heartbeat$ messages to all of the other servers to establish its authority and prevent new** $elections$.

While waiting for votes, a $candidate$ **may receive an $AppendEntries\ RPC$ from another server claiming to be the $leader$. If the $leader$'s $Term$ (included in the $AppendEntries\ RPC$) is at least as large as the $candidate$'s $current\ term\ number$, then the $candidate$ recognizes the $leader$ as legitimate and returns to the $follower$ state. If it is smaller than the $candidate$'s $current\ term\ number$, the $candidate$ rejects the $RPC$ and remains in the $candidate$ state**.

The third possible outcome is that a $candidate$ neither wins nor loses the $election$: if many $followers$ become $candidates$ at the same time, votes could be split so that no $candidate$ obtains a majority. When this happens, each $candidate$ times out and starts a new $election$ by incrementing its $Term$ and initiating another round of $RequestVote\ RPCs$. However, without extra measures split votes could repeat indefinitely.

**$Raft$ uses $randomized\ election\ timeouts$ to ensure that split votes are rare and that they are resolved quickly**. To prevent split votes, $election$ **timeouts are chosen randomly from a fixed interval** ($e.g.\ 150 \sim 300ms$). This spreads out the servers' timeouts so that in most cases only a single server times out; it wins the $election$ and sends $heartbeats$ before any other servers time out. The same mechanism is used to handle split votes. Each $candidate$ restarts its randomized $election$ timeout at the start of an $election$, and it waits for that timeout to elapse before starting the next $election$; this reduces the likelihood of another split vote in the new $election$.

### Log Replication

Once a $leader$ has been elected, it begins servicing client requests. Each client request contains a command to be executed by the $RSM$ ($replicated\ state\ machine$). The $leader$ **appends the command to its $log$ as a new $entry$, then issues $AppendEntries\ RPCs$ in parallel to replicate the $entry$ to the other servers**. When the $entry$ has been safely replicated, the $leader$ applies the $entry$ to its state machine and returns the result of that execution to the client. If $followers$ crash or run slowly, or if network packets are lost, the $leader$ retries $AppendEntries\ RPCs$ indefinitely until all $followers$ eventually store all $log\ entries$.

The $log$ is organized as shown in the figure below. Each $log\ entry$ stores a state machine command along with the $term\ number$ when the $entry$ was received by the $leader$. The $term\ numbers$ in $log\ entries$ are used to detect inconsistencies between logs and to ensure some of the properties. Each $log\ entry$ also has an integer index identifying its position in the $log$.

<a name="Figure7"></a>
![Figure 7](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202409271118027.png)

**The $leader$ decides when it is safe to apply a $log\ entry$ to the state machines; such an entry is called $committed$**. $Raft$ guarantees that $committed$ entries are durable and will eventually be executed by all of the available state machines. **A $log\ entry$ is $committed$ once the $leader$ that created the entry has replicated it on a majority of the servers (e.g., $entry\ 7$ in the figure above)**. This also commits all preceding entries in the $leader's\ log$, including entries created by previous $leaders$. The next section discusses some subtleties of applying this rule after $leader$ changes, and shows that this definition of $commitment$ is safe. The $leader$ keeps track of the $highest\ index$ it knows to be $committed$, and it includes that index in future $AppendEntries\ RPCs$ (including $heartbeats$) so that the other servers eventually find out. Once a $follower$ learns that a $log\ entry$ is $committed$, it applies the entry to its local state machine in log order.

This mechanism not only simplifies the system's behavior and makes it more predictable, but is also an important component of safety. $Raft$ maintains the following properties, which together constitute the $Log\ Matching\ Property$:

- **If two $entries$ in different $logs$ have the same $index$ and $term$, then they store the same $command$**
- **If two $entries$ in different $logs$ have the same $index$ and $term$, then the $logs$ are identical in all preceding $entries$**

**The first property follows from the fact that a $leader$ creates at most one $entry$ with a given $log\ index$ in a given $Term$, and $log\ entries$ never change position in the $log$. The second property is guaranteed by a simple consistency check performed by $AppendEntries\ RPCs$**. **When sending an $AppendEntries\ RPC$, the $leader$ includes the $index$ and $Term$ of the $entry$ in its $log$ that immediately precedes the new $entries$. If the $follower$ does not find an $entry$ with the same $index$ and $Term$ in its $log$, then it refuses the new** $entries$. The consistency check acts as an induction step: the initial empty state of the $log$ satisfies the $Log\ Matching\ Property$, and the consistency check preserves the $Log\ Matching\ Property$ whenever the $log$ is extended. As a result, whenever $AppendEntries$ returns success, the $leader$ knows that the $follower$'s $log$ is identical to its own $log$ up through the new $entries$.

During normal operation the logs of the $leader$ and its $followers$ stay consistent, so the $AppendEntries$ consistency check never fails. However, $leader$ **crashes can leave the logs inconsistent (the old $leader$ may not have fully replicated all of the $entries$ in its $log$)**. These inconsistencies can compound over a series of $leader$ and $follower$ crashes. [This figure](#Figure7) illustrates the ways in which $followers$' logs may differ from that of a new $leader$. **A $follower$ may be missing $entries$ that are present on the $leader$, it may have extra $entries$ that are not present on the $leader$, or both**. Missing and extraneous $entries$ in a $log$ may span multiple $Terms$.

In $Raft$, the $leader$ **handles inconsistencies by forcing the $followers'$ logs to duplicate its own. This means that conflicting $entries$ in $follower$ logs will be overwritten with $entries$ from the $leader$'s log**. The next section shows that this is safe when coupled with one more restriction.

To bring a $follower$'s $log$ into consistency with its own, the $leader$ **must find the latest $log\ entry$ where the two logs agree, delete any $entries$ in the $follower$'s $log$ after that point, and send the $follower$ all of the $leader$'s $entries$ after that point**.

> Note the implication here: if a $follower$ has a $committed$ entry under the same $term$ and $index$ that disagrees with the $leader$'s, that violates the $Log\ Matching\ Property$ and means the $follower$ is wrong from that point on. Therefore all $entries$ after that point are deleted, and the $leader$'s subsequent $entries$ are replicated to restore consistency.

All of these actions happen in response to the consistency check performed by $AppendEntries\ RPCs$. The $leader$ maintains a $nextIndex$ for each $follower$, which is the $index$ of the next $log\ entry$ the $leader$ will send to that $follower$. When a $leader$ first comes to power, it initializes all $nextIndex$ values to the $index$ just after the last one in its $log$ (11 in the figure below). If a $follower$'s $log$ is inconsistent with the $leader$'s, the $AppendEntries$ consistency check will fail in the next $AppendEntries\ RPC$. After a rejection, the $leader$ decrements $nextIndex$ and retries the $AppendEntries\ RPC$. Eventually $nextIndex$ will reach a point where the $leader$ and $follower$ logs match. When this happens, $AppendEntries$ will succeed, which removes any conflicting $entries$ in the $follower$'s $log$ and appends $entries$ from the $leader$'s $log$ (if any). Once $AppendEntries$ succeeds, the $follower$'s $log$ is consistent with the $leader$'s, and it will remain that way for the rest of the $Term$.

> If desired, the protocol can be optimized to reduce the number of rejected $AppendEntries\ RPCs$.

With this mechanism, a $leader$ does not need to take any special actions when it comes to power to restore log consistency. It just begins normal operation, and the logs automatically converge in response to failures of the $AppendEntries$ consistency check. A $leader$ **never overwrites or deletes** $entries$ **in its own** $log$ (the $Leader\ Append\text{-}Only\ Property$ in [this figure](#Figure3))

### Safety

The previous sections described how $Raft$ elects $leaders$ and replicates $log\ entries$. **However, the mechanisms described so far are not quite sufficient to ensure that each state machine executes exactly the same commands in the same order**. For example, a $follower$ might be unavailable while the $leader$ commits several $log\ entries$, then it could be elected $leader$ and overwrite these $entries$ with new ones; as a result, different state machines might execute different command sequences.

This section completes the $Raft$ algorithm by adding a restriction on **which servers may be elected** $leader$. The restriction ensures that the $leader$ **for any given $Term$ contains all of the $entries$ $committed$ in previous $Terms$** (the $Leader\ Completeness\ Property$ from [this figure](#Figure3)).

#### Election Restriction

In any $leader\text{-}based$ consensus algorithm, the $leader$ must eventually store all of the $committed\ log\ entries$. $Raft$ uses a simpler approach: **it guarantees that each new $leader$ contains all of the $entries$ $committed$ in previous $Terms$ from the moment of its election, without transferring those $entries$ to the $leader$. This means that $log\ entries$ only flow in one direction ($leaders \rightarrow followers$), and $leaders$ never overwrite existing $entries$ in their $logs$**.

$Raft$ uses the voting process to prevent a $candidate$ from winning an election unless its $log$ contains all $committed$ entries. A $candidate$ must contact a majority of the cluster in order to be $elected$, which means that every $committed$ entry must be present on at least one of those servers. If the $candidate$'s $log$ is at least as $up\text{-}to\text{-}date$ as any other log in that majority (this will be explained shortly), then it holds all the $committed\ entries$. The $RequestVote\ RPCs$ implement this restriction: **the RPC includes information about the $candidate$'s $log$, and the voter denies its vote if its own $log$ is more $up\text{-}to\text{-}date$ than the $candidate$'s**.

> $Raft$ determines which of two $logs$ is more $up\text{-}to\text{-}date$ by comparing the $index$ and $Term$ of the last $entries$ in the $logs$.  
> **If the $logs$ have last $entries$ with different $Terms$, then the log with the larger (later) $Term$ is more** $up\text{-}to\text{-}date$.  
> **If the $logs$ end with the same $Term$, then the $log$ with the larger (longer) $index$ is more** $up\text{-}to\text{-}date$.

#### Committing entries from previous terms

As described before, a $leader$ **knows that an $entry$ from its $current\ term$ is $committed$ once that $entry$ is stored on a majority of the servers**. If a $leader$ crashes before committing an $entry$, the next $leader$ will try to finish replicating the $entry$. However, **a $leader$ cannot immediately conclude that an $entry$ from a previous $Term$ is $committed$ once it is stored on a majority of servers**. The figure below illustrates such a situation, where an old $log\ entry$ is stored on a majority of servers, yet it can still be overwritten by a future $leader$.

<a name="Figure8"></a>
![Figure 8](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202409271744503.png)

The figure above illustrates the problem: if $S1$ crashes in situation (c), then even though $[2]$ has been replicated to a majority of servers, it is still not $committed$; (in situation (d), $S5$ is elected $leader$ and replicates $[3]$ to the other servers, causing $[2]$ to be lost; if instead $S1$ reaches situation (e), where before crashing it has replicated an $entry$ from $Term\ 3$ and that $entry$ gets $committed$, then even if $S1$ crashes, $S5$ can no longer be elected $leader$).

To eliminate problems like the one in [the figure above](#Figure8), $Raft$ **never commits $log\ entries$ from previous $Terms$ by counting replicas. Only $log\ entries$ from the $leader$'s $current\ term\ number$ are $committed$ by counting replicas; once an $entry$ from the $current\ term$ has been committed in this way, then all prior $entries$ are $committed$ indirectly because of the $Log\ Matching\ Property$ (which requires that *if two $entries$ in different $logs$ have the same $index$ and $term$, then the $logs$ are identical in all preceding $entries$*). There are some situations where a $leader$ could safely conclude that an older $log\ entry$ is $committed$, but $Raft$ takes a more conservative approach to simplify the implementation**.

$Raft$ incurs this extra complexity in the commitment rules **because $log\ entries$ retain their original $term\ numbers$ when a $leader$ replicates $entries$ from previous $Terms$**. In other consensus algorithms, if a new $leader$ re-replicates $entries$ from prior $terms$, it must do so with its new $term\ number$. In addition, a new $leader$ in $Raft$ sends fewer $log\ entries$ from previous $Terms$ than in other algorithms.

#### Safety Argument

Given the complete $Raft$ algorithm, we can now argue more precisely that the [$Leader\ Completeness\ Property$](#Figure3) holds. We assume the opposite and derive a contradiction. *Suppose the $leader$ for $Term\ T$ (denoted $leader_T$) committed a $log\ entry$ from its $Term$, but that $log\ entry$ was not stored by the $leader$ of some future $Term$. Consider the smallest $Term\ U \gt T$ whose $leader_U$ does not store the* $log\ entry$.

> $Leader\ Completeness\ Property$  
> **If a $log\ entry$ is $committed$ in a given $Term$, then that $entry$ will be present in the $logs$ of the $leaders$ for all $higher\text{-}numbered\ Terms$**

![Figure 9](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202409291025322.png)

1. The $committed$ $entry$ must have been absent from $leader_U$'s $log$ at the time of its election ($leaders$ never delete or overwrite $entries$)
2. $leader_T$ replicated the $entry$ on a majority of the cluster, and $leader_U$ received votes from a majority of the cluster. Thus, at least one server both accepted the $entry$ from $leader_T$ and voted for $leader_U$, as shown in the figure above. *This voter is key to reaching the contradiction*
3. The voter must have accepted the $committed\ entry$ from $leader_T$ before voting for $leader_U$; otherwise it would have rejected the $AppendEntries$ request from $leader_T$ (its $current\ term$ would then have been higher than $leader_T$'s)
4. The voter still stored the $entry$ when it voted for $leader_U$, since every intervening $leader$ contained the $entry$ by assumption; note that $leaders$ *never remove $entries$, and $followers$ remove $entries$ only when they conflict with the $leader$*
5. The voter granted its vote to $leader_U$, so $leader_U$'s $log$ must have been as $up\text{-}to\text{-}date$ as the voter's. This leads to a contradiction.
6. First, if the voter and $leader_U$ shared the same $last\ log\ term$, then $leader_U$'s $log$ must have been at least as long as the voter's, so its $log$ contained every $entry$ in the voter's $log$. This is a contradiction, since we assumed *the voter contained the $committed\ entry$ and $leader_U$ did not*.
7. Otherwise, $leader_U$'s $last\ log\ term$ must have been larger than the voter's. Moreover, it was larger than $T$, since the voter's $last\ log\ term$ was at least $T$ (it contains the $committed\ entry$ from $Term\ T$). By assumption, the earlier $leader$ that created $leader_U$'s $last\ log\ entry$ must have contained the $committed\ entry$ in its $log$. Then, by the $Log\ Matching\ Property$, $leader_U$'s $log$ must also contain the $committed\ entry$, which is another contradiction.
8. Therefore, the $leaders$ of all $Terms$ greater than $T$ must contain all $entries$ $committed$ in $Term\ T$
9. The $Log\ Matching\ Property$ guarantees that future $leaders$ will also contain $entries$ that are $committed$ indirectly

### Follower and Candidate crashes

Until this point we have focused on $leader$ failures. $Follower$ and $candidate$ crashes are much simpler to handle than $leader$ crashes, and they are both handled the same way. If a $follower$ or $candidate$ crashes, then future $RequestVote$ and $AppendEntries\ RPCs$ sent to it will fail. $Raft$ handles these failures by retrying indefinitely; if the crashed server restarts, then the $RPC$ will complete successfully. If a server crashes after completing an $RPC$ but before responding, then it will receive the same $RPC$ again after it restarts. $Raft\ RPCs$ are idempotent, so this causes no harm. For example, if a $follower$ receives an $AppendEntries$ request that includes $log\ entries$ already present in its $log$, it ignores the $entries$ in the new request.

> Idempotent  
> Idempotence means that performing the same operation multiple times yields the same result. In network requests, if a request is idempotent, no matter how many times it is executed, the final state is the same and no extra side effects occur. This keeps the system reliable in the presence of failures.

### Timing and Availability

**One of our requirements for $Raft$ is that safety must not depend on timing: the system must not produce incorrect results just because some events happen more quickly or slowly than expected**. However, availability (the ability of the system to respond to clients in a timely manner) must inevitably depend on timing. For example, if message exchanges take longer than the typical time between server crashes, $candidates$ will not stay alive long enough to win an $election$; without a steady $leader$, $Raft$ cannot make progress.

$Leader\ election$ is the aspect of $Raft$ where timing is most critical. $Raft$ will be able to $elect$ and maintain a steady $leader$ as long as the system satisfies the following timing requirement:

$$
  broadcastTime \ll electionTimeout \ll MTBF
$$

In this inequality $broadcastTime$ is the average time it takes a server to send $RPCs$ in parallel to every server in the cluster and receive their responses; $electionTimeout$ is the $election$ timeout described in the [Leader Election](#leader-election) section; and $MTBF$ is the average time between failures for a single server. $broadcastTime$ **should be an order of magnitude or two less than $electionTimeout$ so that $leaders$ can reliably send the $heartbeat$ messages required to keep $followers$ from starting $elections$; given the randomized $election$ timeout approach, this inequality also makes split votes unlikely. $electionTimeout$ should be a few orders of magnitude less than $MTBF$ so that the system can make steady progress**. When the $leader$ crashes, the system will be unavailable for roughly the $electionTimeout$; we would like this to represent only a small fraction of overall time.

**$broadcastTime$ and $MTBF$ are properties of the underlying system, while $electionTimeout$ is something we must choose**. $Raft$'s $RPCs$ typically require the recipient to persist information to stable storage, so the broadcast time may range from $0.5$ to $20ms$, depending on storage technology. As a result, $electionTimeout$ is likely to be somewhere between $10$ and $500ms$. Typical server $MTBFs$ are several months or more, which easily satisfies the timing requirement.

## Appendix A

![Raft](https://hexo-pirctures.oss-cn-chengdu.aliyuncs.com/imgs202409261551936.png)

- Election process
  - Suppose all servers start in the $follower$ state, each with an $electionTimeout$. When any $follower$'s $electionTimeout$ elapses, it immediately transitions to the $candidate$ state,
