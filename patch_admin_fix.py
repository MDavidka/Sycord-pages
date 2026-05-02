with open("app/admin/vps-runner/page.tsx", "r") as f:
    content = f.read()

# Fix the broken syntax from the previous regex replacement
broken_pattern = '''  }
    } catch (e) {
      console.error(e)
    }
  }`, { method: 'POST' })
      fetchStatus()
    } catch (e) {
      console.error(e)
    }
  }'''

fixed_replacement = '''  }'''

content = content.replace("  }`, { method: 'POST' })\n      fetchStatus()\n    } catch (e) {\n      console.error(e)\n    }\n  }", "")

with open("app/admin/vps-runner/page.tsx", "w") as f:
    f.write(content)
