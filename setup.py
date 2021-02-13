import setuptools
import sys

with open("README.md" ,"r", encoding='utf8') as fh:
    long_description = fh.read()

setuptools.setup(
    name="fluent",
    version="0.1",
    url='https://github.com/meson800/fluent',
    author="Christopher Johnstone",
    author_email="meson800@gmail.com",
    description="A node- and Bokeh-based flow cytometry platform.",
    license='GPLv2+',
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=["fluent"],
    package_dir={'': 'src'},
    entry_points={
        "console_scripts": [
            "fluent=fluent:dispatch_console"
            ],
        },
    classifiers=[
        "Development Status :: 2 - Pre-Alpha",
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: GNU General Public License v2 or later (GPLv2+)",
        "Operating System :: OS Independent",
        ],
    install_requires=[
        'bokeh >= 2.2',
        'fcsparser >= 0.2',
        ],
    python_requires='>=3'
)
