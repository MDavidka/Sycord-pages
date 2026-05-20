"use client"

import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { LineGraph } from "@/components/ui/line-graph"
import { cn } from "@/lib/utils"

export const Page = ({ className, children }: React.ComponentProps<"div">) => (
  <div className={cn("space-y-0", className)}>{children}</div>
)

export const Section = ({ className, children, id }: React.ComponentProps<"section">) => (
  <section id={id} className={cn("relative w-full py-20 md:py-24", className)}>
    {children}
  </section>
)

export const Container = ({ className, children }: React.ComponentProps<"div">) => (
  <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>
)

export const Grid = ({ className, children }: React.ComponentProps<"div">) => (
  <div className={cn("grid gap-6 md:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>
)

export const Stack = ({ className, children }: React.ComponentProps<"div">) => (
  <div className={cn("flex flex-col gap-4", className)}>{children}</div>
)

export const Heading = ({
  level = 2,
  className,
  children,
}: {
  level?: number
  className?: string
  children?: React.ReactNode
}) => {
  const Tag = `h${Math.min(6, Math.max(1, level))}` as keyof JSX.IntrinsicElements
  return <Tag className={cn("text-balance text-3xl font-semibold tracking-tight sm:text-4xl", className)}>{children}</Tag>
}

export const Text = ({ className, children }: React.ComponentProps<"p">) => (
  <p className={cn("text-pretty text-muted-foreground", className)}>{children}</p>
)

export const RuntimeImage = ({
  className,
  src,
  alt,
  width,
  height,
}: React.ImgHTMLAttributes<HTMLImageElement>) => (
  <img className={cn("rounded-2xl object-cover", className)} src={src} alt={alt} width={width} height={height} />
)

export const PricingCard = ({
  className,
  title,
  cta,
  children,
}: {
  className?: string
  title?: string
  cta?: string
  children?: React.ReactNode
}) => (
  <Card className={cn("border-border/60", className)}>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>{children}</CardContent>
    <CardFooter>{cta ? <Button>{cta}</Button> : null}</CardFooter>
  </Card>
)

export const FeatureCard = ({
  className,
  title,
  description,
  children,
}: {
  className?: string
  title?: string
  description?: string
  children?: React.ReactNode
}) => (
  <Card className={cn("border-border/60", className)}>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
)

export const Stat = ({
  className,
  value,
  prefix,
  suffix,
  children,
}: {
  className?: string
  value?: string
  prefix?: string
  suffix?: string
  children?: React.ReactNode
}) => (
  <div className={cn("rounded-2xl border bg-card p-6", className)}>
    <div className="text-3xl font-semibold">
      {prefix}{value}{suffix}
    </div>
    {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
  </div>
)

export const RuntimeComponents = {
  Page,
  Section,
  Container,
  Grid,
  Stack,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Input,
  Textarea,
  Label,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Separator,
  Image: RuntimeImage,
  Link,
  Heading,
  Text,
  Stat,
  PricingCard,
  FeatureCard,
  LineGraph,
}

export type RuntimeComponentKey = keyof typeof RuntimeComponents
