"""
Resume template definitions
Similar to Microsoft Word resume templates with visual layouts
"""

RESUME_TEMPLATES = [
    {
        "id": "modern-professional",
        "name": "Modern Professional",
        "description": "Clean, modern design perfect for tech and corporate roles. Features a sidebar with skills and contact info.",
        "category": "tech",
        "is_ats_friendly": True,
        "is_active": True,
        "display_order": 1,
        "preview_url": "/templates/previews/modern-professional.png",
        "thumbnail_url": "/templates/thumbnails/modern-professional.png",
        "layout_config": {
            "page_size": "letter",  # 8.5" x 11"
            "margins": {
                "top": 0.5,
                "bottom": 0.5,
                "left": 0.5,
                "right": 0.5
            },
            "layout_type": "two-column",  # sidebar + main content
            "sidebar_width": "30%",
            "fonts": {
                "heading": {
                    "family": "Calibri",
                    "size": 16,
                    "weight": "bold",
                    "color": "#2C3E50"
                },
                "subheading": {
                    "family": "Calibri",
                    "size": 12,
                    "weight": "bold",
                    "color": "#34495E"
                },
                "body": {
                    "family": "Calibri",
                    "size": 11,
                    "weight": "normal",
                    "color": "#000000"
                }
            },
            "colors": {
                "primary": "#3498DB",      # Blue
                "secondary": "#2C3E50",    # Dark gray
                "accent": "#ECF0F1",       # Light gray background
                "text": "#000000"
            },
            "spacing": {
                "line_height": 1.15,
                "section_spacing": 12,
                "item_spacing": 6
            },
            "sections": {
                "sidebar": ["contact", "skills", "certifications", "languages"],
                "main": ["professional_summary", "experience", "education", "projects"]
            },
            "features": {
                "skill_bars": True,        # Visual skill proficiency bars
                "section_dividers": True,   # Horizontal lines between sections
                "icons": True,              # Icons for contact info
                "bullet_style": "disc"
            }
        }
    },

    {
        "id": "classic-traditional",
        "name": "Classic Traditional",
        "description": "Timeless, professional format ideal for traditional industries like finance, law, and consulting.",
        "category": "executive",
        "is_ats_friendly": True,
        "is_active": True,
        "display_order": 2,
        "preview_url": "/templates/previews/classic-traditional.png",
        "thumbnail_url": "/templates/thumbnails/classic-traditional.png",
        "layout_config": {
            "page_size": "letter",
            "margins": {
                "top": 1.0,
                "bottom": 1.0,
                "left": 1.0,
                "right": 1.0
            },
            "layout_type": "single-column",
            "fonts": {
                "heading": {
                    "family": "Times New Roman",
                    "size": 14,
                    "weight": "bold",
                    "color": "#000000"
                },
                "subheading": {
                    "family": "Times New Roman",
                    "size": 12,
                    "weight": "bold",
                    "color": "#000000"
                },
                "body": {
                    "family": "Times New Roman",
                    "size": 11,
                    "weight": "normal",
                    "color": "#000000"
                }
            },
            "colors": {
                "primary": "#000000",
                "secondary": "#333333",
                "accent": "#FFFFFF",
                "text": "#000000"
            },
            "spacing": {
                "line_height": 1.5,
                "section_spacing": 16,
                "item_spacing": 8
            },
            "sections": {
                "main": ["contact", "professional_summary", "experience", "education", "skills", "certifications"]
            },
            "features": {
                "skill_bars": False,
                "section_dividers": False,
                "icons": False,
                "bullet_style": "square"
            }
        }
    },

    {
        "id": "creative-professional",
        "name": "Creative Professional",
        "description": "Modern design with color accents for creative roles. Balanced between visual appeal and ATS compatibility.",
        "category": "creative",
        "is_ats_friendly": True,  # Fixed to be ATS-friendly while maintaining visual appeal
        "is_active": True,
        "display_order": 3,
        "preview_url": "/templates/previews/creative-professional.png",
        "thumbnail_url": "/templates/thumbnails/creative-professional.png",
        "layout_config": {
            "page_size": "letter",
            "margins": {
                "top": 0.75,
                "bottom": 0.75,
                "left": 0.75,
                "right": 0.75
            },
            "layout_type": "single-column",  # Changed to single-column for ATS
            "fonts": {
                "heading": {
                    "family": "Calibri",  # Changed to ATS-safe font
                    "size": 16,
                    "weight": "bold",
                    "color": "#2C3E50"
                },
                "subheading": {
                    "family": "Calibri",
                    "size": 12,
                    "weight": "bold",
                    "color": "#34495E"
                },
                "body": {
                    "family": "Calibri",
                    "size": 11,
                    "weight": "normal",
                    "color": "#000000"
                }
            },
            "colors": {
                "primary": "#3498DB",       # Professional blue
                "secondary": "#2C3E50",     # Dark gray
                "accent": "#16A085",        # Teal accent
                "text": "#000000"           # Black for ATS
            },
            "spacing": {
                "line_height": 1.15,
                "section_spacing": 12,
                "item_spacing": 6
            },
            "sections": {
                "main": ["contact", "professional_summary", "experience", "projects", "education", "skills"]
            },
            "features": {
                "skill_bars": False,         # Removed for ATS
                "section_dividers": True,    # Simple text dividers
                "icons": False,              # Removed for ATS
                "bullet_style": "disc",      # Standard bullets
                "header_banner": False,      # Removed for ATS
                "skill_tags": False,         # Listed as text for ATS
                "color_accents": True        # Subtle color in section headers only
            }
        }
    },

    {
        "id": "ats-optimized",
        "name": "ATS Optimized",
        "description": "Specifically designed to pass Applicant Tracking Systems while maintaining professional appearance.",
        "category": "tech",
        "is_ats_friendly": True,
        "is_active": True,
        "display_order": 4,
        "preview_url": "/templates/previews/ats-optimized.png",
        "thumbnail_url": "/templates/thumbnails/ats-optimized.png",
        "layout_config": {
            "page_size": "letter",
            "margins": {
                "top": 0.75,
                "bottom": 0.75,
                "left": 0.75,
                "right": 0.75
            },
            "layout_type": "single-column",
            "fonts": {
                "heading": {
                    "family": "Arial",
                    "size": 14,
                    "weight": "bold",
                    "color": "#000000"
                },
                "subheading": {
                    "family": "Arial",
                    "size": 11,
                    "weight": "bold",
                    "color": "#000000"
                },
                "body": {
                    "family": "Arial",
                    "size": 10,
                    "weight": "normal",
                    "color": "#000000"
                }
            },
            "colors": {
                "primary": "#000000",
                "secondary": "#000000",
                "accent": "#FFFFFF",
                "text": "#000000"
            },
            "spacing": {
                "line_height": 1.15,
                "section_spacing": 12,
                "item_spacing": 6
            },
            "sections": {
                "main": ["contact", "professional_summary", "skills", "experience", "education", "certifications"]
            },
            "features": {
                "skill_bars": False,         # No graphics for ATS
                "section_dividers": False,   # Simple text dividers only
                "icons": False,              # No icons
                "bullet_style": "simple",    # Simple bullets
                "all_caps_headers": True,    # ALL CAPS section headers for ATS parsing
                "date_format": "MM/YYYY"     # Standard date format
            }
        }
    },

    {
        "id": "minimal-clean",
        "name": "Minimal Clean",
        "description": "Minimalist design with plenty of white space. Perfect for senior roles and executives.",
        "category": "executive",
        "is_ats_friendly": True,
        "is_active": True,
        "display_order": 5,
        "preview_url": "/templates/previews/minimal-clean.png",
        "thumbnail_url": "/templates/thumbnails/minimal-clean.png",
        "layout_config": {
            "page_size": "letter",
            "margins": {
                "top": 1.0,
                "bottom": 1.0,
                "left": 0.75,
                "right": 0.75
            },
            "layout_type": "single-column",
            "fonts": {
                "heading": {
                    "family": "Helvetica",
                    "size": 16,
                    "weight": "300",  # Light weight
                    "color": "#2C3E50"
                },
                "subheading": {
                    "family": "Helvetica",
                    "size": 11,
                    "weight": "500",
                    "color": "#34495E"
                },
                "body": {
                    "family": "Helvetica",
                    "size": 10,
                    "weight": "normal",
                    "color": "#555555"
                }
            },
            "colors": {
                "primary": "#2C3E50",
                "secondary": "#7F8C8D",
                "accent": "#ECF0F1",
                "text": "#555555"
            },
            "spacing": {
                "line_height": 1.4,
                "section_spacing": 18,
                "item_spacing": 10
            },
            "sections": {
                "main": ["contact", "professional_summary", "experience", "education", "skills"]
            },
            "features": {
                "skill_bars": False,
                "section_dividers": True,    # Subtle thin lines
                "icons": False,
                "bullet_style": "minimal",   # Minimal bullets
                "uppercase_name": True,      # Name in uppercase
                "thin_dividers": True        # Very thin section dividers
            }
        }
    }
]
