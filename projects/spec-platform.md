# spec-platform — Spec Graph

```mermaid
graph LR
    Node[Node]
    Edge[Edge]
    Task[Task]
    Prediction[Prediction]
    Vector[Vector]
    Event[Event]
    Compile -->|| .dag
    Node -->|| Node
    Task -->|| Task
    Prediction -->|| Task
    Vector -->|| Node
```
