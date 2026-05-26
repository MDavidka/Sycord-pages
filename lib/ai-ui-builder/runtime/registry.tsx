import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import type { ComponentType } from "react"

export const builderRegistry: Record<string, ComponentType<any> | string> = {
  Page: "div",
  Section: "section",
  Container: "div",
  Grid: "div",
  Stack: "div",
  Card,
  Button,
  Input,
  Accordion: "div",
  Tabs: "div",
  Avatar,
  Badge,
  Image: "img",
  Text: "p",
  Heading: "h2",
  LineGraph: "div",
}
