# RADAR AI — Disaster Response Decision Support System

> **SIH26206 | Smart India Hackathon**
>
> An intelligent disaster-response decision support system for real-time risk assessment, disaster simulation, resource allocation, and disaster-aware routing.

---

## 🚨 Overview

**RADAR AI** is a disaster-response decision support system designed to help emergency-response teams make faster and more informed operational decisions during rapidly changing disaster situations.

The system models a disaster environment as interconnected **zones and roads**, continuously evaluates risk, simulates disaster escalation, determines response requirements, allocates available resources, and generates response plans.

The goal is to move beyond simply displaying disaster data and instead provide **actionable decision support**.

---

## 🎯 Problem

During disasters such as floods, emergency-response teams have to make decisions while dealing with:

- Rapidly changing risk conditions
- Limited emergency resources
- Damaged or inaccessible roads
- Multiple affected zones
- Changing evacuation requirements
- Increasing demand for rescue and medical services
- Uncertainty about the safest and fastest routes

A response system therefore needs to understand the **entire operational network**, rather than treating each affected location independently.

---

## 💡 Solution

RADAR AI combines several decision-support components into a unified system:

```text
                    ┌─────────────────────┐
                    │   Disaster Data     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Risk Engine      │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
      ┌────────────┐    ┌─────────────┐   ┌─────────────┐
      │ Simulation │    │   Routing   │   │  Resource   │
      │   Engine   │    │   Engine    │   │  Allocation │
      └─────┬──────┘    └──────┬──────┘   └──────┬──────┘
            │                  │                 │
            └──────────────────┼─────────────────┘
                               ▼
                    ┌─────────────────────┐
                    │ Response Coordinator│
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Response Plan     │
                    └─────────────────────┘
